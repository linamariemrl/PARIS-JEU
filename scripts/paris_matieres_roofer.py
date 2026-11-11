#!/usr/bin/env python3
"""PARIS Matières — préparation contrôlée du pilote Roofer / LiDAR HD (J1).

Ce programme prépare le GeoPackage EPSG:2154 d'UNE unité bâtie et, si
un nuage LAS/LAZ officiel est fourni localement avec son manifeste, peut
appeler Roofer. La sortie CityJSON est une étape intermédiaire NON intégrée :
pas de GLB enrichi ni de précision LiDAR certifiée à ce stade.

Usage :
  python scripts/paris_matieres_roofer.py prepare bat:BATIMENT0000000305564422
  python scripts/paris_matieres_roofer.py checksum /chemin/LHD_FXX_0652_6862.laz
  python scripts/paris_matieres_roofer.py run bat:BATIMENT0000000305564422 \
       --nuage /chemin/LHD_FXX_0652_6862.laz \
       --provenance /chemin/LHD_FXX_0652_6862.source.json
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse

from paris_matieres import BASE, ROOT, directory, parse_id

WORK = ROOT / "travail/paris-matieres"
DENIED = ("earth.google.com", "maps.google.com", "maps.googleapis.com",
          "streetview.googleapis.com", "maps.gstatic.com", "bing.com",
          "virtualearth.net", "apple.com", "here.com")
SHA = re.compile(r"^[a-f0-9]{64}$")
EPSG = "EPSG:2154"


def read_building(uid: str, root: Path = BASE) -> dict:
    typ, _ = parse_id(uid)
    if typ != "bat":
        raise ValueError("Roofer attend une unité bâtiment")
    path = directory(root, uid) / "unite.json"
    doc = json.loads(path.read_text(encoding="utf8"))
    if doc.get("schema") != "paris-unite/1" or doc.get("id") != uid:
        raise ValueError("Unité incompatible avec le contrat PARIS")
    if doc.get("type") != "batiment":
        raise ValueError("L'unité ne décrit pas un bâtiment")
    geo = doc.get("georeferencement") or {}
    if geo.get("crs") != EPSG or geo.get("altimetrie") != "NGF-IGN69":
        raise ValueError("Repère métrique/altimétrique non conforme")
    if not isinstance(geo.get("emprise2154"), list) or not geo["emprise2154"]:
        raise ValueError("Emprise Lambert-93 absente")
    if not all(isinstance(geo.get("ancre", {}).get(k), (float, int))
               for k in ("e", "n", "altitude")):
        raise ValueError("Ancre manquante")
    return doc


def footprint_geometry(doc: dict) -> dict:
    """Préserve chaque corps bâti et chaque cour sans dessiner de nouvelles ailes."""
    from shapely.geometry import MultiPolygon, Polygon, mapping
    polygons = []
    for rings in doc["georeferencement"]["emprise2154"]:
        if not isinstance(rings, list) or not rings:
            raise ValueError("Polygone IGN vide")
        poly = Polygon(rings[0], rings[1:])
        if not poly.is_valid or poly.is_empty or poly.area < 1:
            raise ValueError("Emprise IGN invalide : ne pas la réparer artificiellement")
        polygons.append(poly)
    geom = MultiPolygon(polygons)
    if not geom.is_valid:
        raise ValueError("Géométrie multipartie non valide")
    return mapping(geom)


def write_footprint(doc: dict, output: Path) -> Path:
    """Le GeoPackage porte explicitement son CRS ; ne pas écrire du L93 en GeoJSON."""
    import fiona
    geom = footprint_geometry(doc)
    output.mkdir(parents=True, exist_ok=True)
    gpkg = output / "empreinte-l93.gpkg"
    if gpkg.exists():
        gpkg.unlink()
    schema = {"geometry": "MultiPolygon",
              "properties": {"identifiant": "str", "version": "str"}}
    with fiona.open(gpkg, "w", driver="GPKG", layer="empreintes",
                    schema=schema, crs=EPSG, encoding="utf-8") as dest:
        dest.write({"type": "Feature", "geometry": geom, "properties": {
            "identifiant": doc["id"][4:], "version": doc["versionBase"]}})
    meta = {
        "schema": "paris-matieres/roofer-entree-1",
        "unite": doc["id"],
        "versionBase": doc["versionBase"],
        "ancre": doc["georeferencement"]["ancre"],
        "crs": EPSG,
        "fichier": gpkg.name,
        "etat": "empreinte-préparée-sans-lidar",
    }
    (output / "entree.json").write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n",
                                        encoding="utf8")
    return gpkg


def checksum(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as src:
        for chunk in iter(lambda: src.read(4 * 1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def check_lidar_source(path: Path, provenance: Path) -> dict:
    if not path.is_file() or path.suffix.lower() not in (".las", ".laz"):
        raise ValueError("Fichier LiDAR local LAS/LAZ absent ou invalide")
    src = json.loads(provenance.read_text(encoding="utf8"))
    if src.get("id") != "ign-lidar-hd" or "Licence Ouverte" not in src.get("licence", ""):
        raise ValueError("Provenance IGN/Licence Ouverte non attestée dans le manifeste")
    url = urlparse(src.get("url", ""))
    if url.scheme != "https" or not url.hostname:
        raise ValueError("Adresse HTTPS de la source absente")
    if any(host in url.hostname.lower() or host in url.geturl().lower() for host in DENIED):
        raise ValueError("Origine graphique interdite")
    proof = src.get("sha256", "")
    if not isinstance(proof, str) or not SHA.fullmatch(proof):
        raise ValueError("Empreinte SHA-256 source absente")
    if checksum(path) != proof:
        raise ValueError("Empreinte du nuage LiDAR différente du manifeste")
    if not src.get("dateAcquisition") or not src.get("dalle"):
        raise ValueError("Date d'acquisition et identifiant de dalle obligatoires")
    return src


def roofer_command(nuage: Path, gpkg: Path, output: Path) -> list[str]:
    if not nuage.is_file() or not gpkg.is_file():
        raise ValueError("Le nuage et l'emprise doivent exister avant le calcul")
    if not shutil.which("roofer"):
        raise RuntimeError("Roofer n'est pas installé ; impossible de traiter le LiDAR")
    return ["roofer", "--lod12", "--lod22", "--split-cjseq",
            str(nuage.resolve()), str(gpkg.resolve()), str(output.resolve())]


def run(uid: str, base: Path, work: Path, nuage: Path, provenance: Path) -> dict:
    doc = read_building(uid, base)
    source = check_lidar_source(nuage, provenance)
    out = directory(work, uid)
    gpkg = write_footprint(doc, out)
    roofer_out = out / "roofer"
    roofer_out.mkdir(parents=True, exist_ok=True)
    cmd = roofer_command(nuage, gpkg, roofer_out)
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=900, check=False)
    (out / "roofer.log").write_text(proc.stdout + "\n" + proc.stderr, encoding="utf8")
    if proc.returncode != 0:
        raise RuntimeError("Roofer a échoué (code %d), consulter roofer.log" % proc.returncode)
    files = sorted(p.name for p in roofer_out.rglob("*.city.jsonl"))
    if not files:
        files = sorted(p.name for p in roofer_out.rglob("*.jsonl"))
    if not files:
        raise RuntimeError("Aucune géométrie CityJSONSequence livrée par Roofer")
    report = {
        "schema": "paris-matieres/roofer-intermediaire-1",
        "unite": uid, "versionBase": doc["versionBase"],
        "etat": "intermediaire-non-valide",
        "fichiersCityJSONSeq": files,
        "sourceLidar": {"url": source["url"], "licence": source["licence"],
                        "sha256": source["sha256"], "dalle": source["dalle"]},
        "outil": "Roofer (CLI)", "date": datetime.now(timezone.utc).isoformat(),
        "message": "Reconstruction préliminaire : le glTF, l'écart RMS mesuré, "
                   "les LOD et le contrôle de réception sont encore à réaliser."
    }
    (out / "etat-roofer.json").write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n",
                                          encoding="utf8")
    return report


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", type=Path, default=BASE)
    parser.add_argument("--travail", type=Path, default=WORK)
    commands = parser.add_subparsers(dest="action", required=True)
    commands.add_parser("prepare").add_argument("unite")
    commands.add_parser("checksum").add_argument("fichier", type=Path)
    job = commands.add_parser("run")
    job.add_argument("unite")
    job.add_argument("--nuage", type=Path, required=True)
    job.add_argument("--provenance", type=Path, required=True)
    args = parser.parse_args(argv)
    try:
        if args.action == "checksum":
            info = {"fichier": str(args.fichier), "sha256": checksum(args.fichier)}
        elif args.action == "prepare":
            doc = read_building(args.unite, args.base)
            path = write_footprint(doc, directory(args.travail, args.unite))
            info = {"unite": args.unite, "gpkg": str(path), "etat": "empreinte-préparée"}
        else:
            info = run(args.unite, args.base, args.travail, args.nuage, args.provenance)
        print(json.dumps(info, ensure_ascii=False, indent=2))
        return 0
    except (OSError, RuntimeError, ValueError, KeyError, ImportError, subprocess.TimeoutExpired) as e:
        print(json.dumps({"erreur": str(e), "etape": args.action}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
