#!/usr/bin/env python3
"""PARIS Matières — découverte IGN LiDAR HD et cache local de dalles (J1).

L'index WFS officiel est pris directement depuis unite.json. Une dalle COPC
n'est téléchargée que sur demande explicite, avec empreinte SHA-256, fichier
atomique et manifeste de provenance. Aucun fournisseur d'images fermé.
"""
from __future__ import annotations
import argparse
import hashlib
import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from paris_matieres import BASE, ROOT, directory, parse_id

OUT = ROOT / "cache/paris-matieres/lidar-hd"
DALL = re.compile(r"^LHD_FXX_[0-9]{4}_[0-9]{4}$")
DENY = ("earth.google.", "maps.google.", "googleapis.com", "gstatic.com",
        "bing.com", "virtualearth.net", "apple.com", "here.com")
USER_AGENT = "PARIS-Matieres/0.1 (outil libre, delai et cache)"
MAX_METADATA = 4 * 1024 * 1024


def safe_url(url: str, official_index=False) -> str:
    if not isinstance(url, str):
        raise ValueError("URL absente")
    u = urlparse(url)
    if u.scheme != "https" or not u.hostname or u.username or u.password:
        raise ValueError("URL HTTPS sans identifiants requise")
    host = u.hostname.lower()
    if any(bad in host or bad in url.lower() for bad in DENY):
        raise ValueError("Domaine cartographique interdit")
    if official_index and host != "data.geopf.fr":
        raise ValueError("L'index WFS doit être servi par data.geopf.fr")
    return url


def source_pointer(unite: dict, dalle: str) -> dict:
    if not DALL.fullmatch(dalle):
        raise ValueError("Identifiant de dalle LiDAR incorrect")
    result = next((s for s in unite.get("sourcesGratuites", [])
                   if s.get("id") == "ign-lidar-hd"), None)
    if not result or dalle not in result.get("dalles1km", []):
        raise ValueError("Dalle absente des sources officielles de l'unité")
    if "Licence Ouverte" not in result.get("licence", ""):
        raise ValueError("Licence IGN non documentée")
    safe_url(result.get("index"), official_index=True)
    return result


def request(url: str, *, max_bytes: int = MAX_METADATA):
    """Lecture limitée et tentatives bornées pour la seule métadonnée WFS."""
    safe_url(url, official_index=True)
    for attempt in range(3):
        try:
            with urlopen(Request(url, headers={
                "Accept": "application/json",
                "User-Agent": USER_AGENT
            }), timeout=45) as response:
                safe_url(response.geturl(), official_index=True)
                body = response.read(max_bytes + 1)
            if len(body) > max_bytes:
                raise ValueError("Réponse WFS trop volumineuse")
            return json.loads(body)
        except HTTPError as e:
            if e.code not in (429, 500, 502, 503, 504) or attempt == 2:
                raise
        except URLError:
            if attempt == 2:
                raise
        time.sleep(1 + 2 * attempt)
    raise RuntimeError("Index WFS inaccessible")


def choose_metadata(collection: dict, dalle: str) -> dict:
    if collection.get("type") != "FeatureCollection":
        raise ValueError("Métadonnées WFS non géographiques")
    matches = []
    for feat in collection.get("features", []):
        props = feat.get("properties") or {}
        if not isinstance(props, dict):
            continue
        fields = {str(k).lower(): v for k, v in props.items()}
        candidate = {"id": feat.get("id", ""), **fields}
        # Refuser de choisir une dalle sur une simple proximité.
        if dalle not in json.dumps(candidate, ensure_ascii=False):
            continue
        links = {}
        for kind in ("url_npl", "url_mnt", "url_mns", "url_mnh"):
            if fields.get(kind):
                links[kind] = safe_url(str(fields[kind]))
        if "url_npl" in links:
            matches.append(links)
    if len(matches) != 1:
        raise ValueError("Dalle attendue non identifiable de manière unique dans WFS : "
                         + dalle + " (candidats : " + str(len(matches)) + ")")
    return matches[0]


def probe(unite: dict, dalle: str) -> dict:
    source = source_pointer(unite, dalle)
    geo = choose_metadata(request(source["index"]), dalle)
    return {
        "schema": "paris-matieres/source-lidar-1",
        "unite": unite["id"],
        "versionBase": unite["versionBase"],
        "dalle": dalle,
        "indexWfs": source["index"],
        "licence": source["licence"],
        "fichiers": geo,
        "etat": "meta-officielle-verifiee-sans-telechargement"
    }


def download(meta: dict, cache: Path, limit_mb: int = 1024) -> dict:
    """Cache atomique d'UN nuage, sans téléchargement massif de la ville."""
    if not 1 <= limit_mb <= 4096:
        raise ValueError("Budget de téléchargement invalide")
    dalle = meta["dalle"]
    if not DALL.fullmatch(dalle):
        raise ValueError("Dalle absente ou invalide")
    url = safe_url(meta["fichiers"]["url_npl"])
    suffix = Path(urlparse(url).path).suffix.lower()
    if suffix not in (".laz", ".las"):
        raise ValueError("Le WFS ne fournit pas d'URL LAS/LAZ exploitable")
    output = cache / (dalle + suffix)
    manifest = cache / (dalle + ".source.json")
    cache.mkdir(parents=True, exist_ok=True)
    if output.exists() or manifest.exists():
        if not output.exists() or not manifest.exists():
            raise ValueError("Cache incomplet, intervention nécessaire")
        old = json.loads(manifest.read_text(encoding="utf8"))
        if old.get("url") != url or old.get("sha256") != hash_file(output):
            raise ValueError("Dalle déjà en cache, provenance ou empreinte discordante")
        return {"fichier": str(output), "manifeste": str(manifest),
                "sha256": old["sha256"], "etat": "cache-valide"}
    partial = output.with_suffix(output.suffix + ".part")
    if partial.exists():
        raise ValueError("Téléchargement incomplet existant : " + str(partial))
    total = 0
    digest = hashlib.sha256()
    cap = limit_mb * 1_000_000
    try:
        with urlopen(Request(url, headers={"User-Agent": USER_AGENT}), timeout=120) as response:
            safe_url(response.geturl())
            size = response.headers.get("Content-Length")
            if size and int(size) > cap:
                raise ValueError("Nuage supérieur au plafond de téléchargement")
            with partial.open("xb") as f:
                header = response.read(4)
                if header != b"LASF":
                    raise ValueError("Flux non reconnu comme LAS/LAZ")
                f.write(header)
                digest.update(header)
                total += len(header)
                while True:
                    block = response.read(4 * 1024 * 1024)
                    if not block:
                        break
                    total += len(block)
                    if total > cap:
                        raise ValueError("Plafond du téléchargement atteint")
                    f.write(block)
                    digest.update(block)
        partial.replace(output)
    except BaseException:
        partial.unlink(missing_ok=True)
        raise
    provenance = {
        "id": "ign-lidar-hd", "url": url, "licence": meta["licence"],
        "sha256": digest.hexdigest(), "dalle": dalle,
        "dateAcquisition": datetime.now(timezone.utc).isoformat(),
        "indexWfs": meta["indexWfs"], "octets": total
    }
    manifest.write_text(json.dumps(provenance, ensure_ascii=False, indent=2) + "\n",
                        encoding="utf8")
    return {"fichier": str(output), "manifeste": str(manifest),
            "sha256": digest.hexdigest(), "octets": total,
            "etat": "telecharge-avec-provenance"}


def hash_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for part in iter(lambda: f.read(4 * 1024 * 1024), b""):
            h.update(part)
    return h.hexdigest()


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("unite")
    ap.add_argument("--base", type=Path, default=BASE)
    ap.add_argument("--dalle", default="LHD_FXX_0652_6862")
    ap.add_argument("--cache", type=Path, default=OUT)
    ap.add_argument("--telecharger", action="store_true")
    ap.add_argument("--limite-mo", type=int, default=1024)
    args = ap.parse_args(argv)
    try:
        parse_id(args.unite)
        path = directory(args.base, args.unite) / "unite.json"
        doc = json.loads(path.read_text(encoding="utf8"))
        if doc.get("id") != args.unite or doc.get("schema") != "paris-unite/1":
            raise ValueError("Unité incompatible avec le contrat")
        result = probe(doc, args.dalle)
        if args.telecharger:
            result = {"recherche": result,
                      "acquisition": download(result, args.cache, args.limite_mo)}
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (OSError, RuntimeError, ValueError, KeyError) as e:
        print(json.dumps({"erreur": str(e)}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
