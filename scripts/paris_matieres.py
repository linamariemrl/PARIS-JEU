#!/usr/bin/env python3
"""PARIS Matières — ordonnanceur local et contrôleur des retours (phase M0).

Ne fabrique PAS de toitures ni de textures : il orchestre des unités existantes,
sans déployer dans le jeu. Les données de terrain restent à acquérir sous
licence ouverte ; tout enrichissement passe par check_unit_return.py.

Exemples :
    python scripts/paris_matieres.py doctor
    python scripts/paris_matieres.py queue --limit 12
    python scripts/paris_matieres.py prepare sol:-2_-1
    python scripts/paris_matieres.py prepare bat:BATIMENT0000000305564422
    python scripts/paris_matieres.py validate bat:BATIMENT0000000305564422
"""
from __future__ import annotations

import argparse
import importlib.util
import json
import math
import re
import shutil
import sys
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BASE = ROOT / "export/unites"
RETURNS = ROOT / "retours"
CATALOGUE = BASE / "catalogue.json"
FOOTPRINTS = ROOT / "public/data/metropole/architecture/heritage-footprints.json"
PILOT = "bat:BATIMENT0000000305564422"
PILOT_SOIL = "sol:-2_-1"
BUILDING_ID = re.compile(r"bat:BATIMENT[0-9]{16}\Z")
SOIL_ID = re.compile(r"sol:-?[0-9]+_-?[0-9]+\Z")
VERSION = re.compile(r"sha256:[a-f0-9]{16}\Z")


def parse_id(value: str) -> tuple[str, str]:
    if BUILDING_ID.fullmatch(value):
        return "bat", value[4:]
    if SOIL_ID.fullmatch(value):
        return "sol", value[4:]
    raise ValueError("Identifiant d'unité invalide : " + value)


def directory(root: Path, uid: str) -> Path:
    typ, rest = parse_id(uid)
    return root / typ / rest


def load_catalogue(path: Path) -> dict:
    with path.open(encoding="utf8") as f:
        doc = json.load(f)
    if doc.get("schema") != "paris-unite/1/catalogue":
        raise ValueError("Schéma de catalogue incompatible")
    if doc.get("colonnes") != ["id", "tuileJeu", "x", "z", "versionBase"]:
        raise ValueError("Colonnes du catalogue non reconnues")
    rows = doc.get("batiments")
    ground = doc.get("sols")
    if not isinstance(rows, list) or not isinstance(ground, list):
        raise ValueError("Catalogue incomplet")
    seen = set()
    for row in rows:
        if not isinstance(row, list) or len(row) != 5:
            raise ValueError("Ligne bâtiment invalide")
        uid, tile, x, z, version = row
        if not isinstance(uid, str) or not BUILDING_ID.fullmatch(uid):
            raise ValueError("Identifiant bâtiment invalide")
        if uid in seen:
            raise ValueError("Doublon de bâtiment " + uid)
        seen.add(uid)
        if not isinstance(tile, str) or not isinstance(x, (int, float)) or not isinstance(z, (int, float)):
            raise ValueError("Position du bâtiment invalide")
        if not math.isfinite(x) or not math.isfinite(z) or not VERSION.fullmatch(str(version)):
            raise ValueError("Position/version du bâtiment invalide")
    for uid in ground:
        if not isinstance(uid, str) or not SOIL_ID.fullmatch(uid) or uid in seen:
            raise ValueError("Dalle dupliquée ou invalide : " + str(uid))
        seen.add(uid)
    return doc


def known_majors(path: Path) -> set[str]:
    with path.open(encoding="utf8") as f:
        doc = json.load(f)
    if not isinstance(doc.get("entries"), list):
        raise ValueError("Appariements IGN patrimoniaux absents")
    result = set()
    for entry in doc["entries"]:
        for ign in entry.get("ignIds", []):
            uid = "bat:" + ign
            parse_id(uid)
            result.add(uid)
    return result


def soil_for(row: list) -> str:
    return "sol:%d_%d" % (math.floor(row[2] / 200), math.floor(row[3] / 200))


def plan(doc: dict, majors: set[str]) -> list[tuple[str, str]]:
    """Ordre déterministe : pilote, majeurs + sols, puis îlots entiers."""
    buildings = {r[0]: r for r in doc["batiments"]}
    sols = set(doc["sols"])
    by_soil: dict[str, list[str]] = defaultdict(list)
    for uid, row in buildings.items():
        by_soil[soil_for(row)].append(uid)
    for ids in by_soil.values():
        ids.sort()
    ordered: list[tuple[str, str]] = []
    emitted: set[str] = set()

    def emit(uid: str, stage: str):
        if uid not in emitted:
            emitted.add(uid)
            ordered.append((uid, stage))

    def emit_building(uid: str, stage: str):
        if uid not in buildings:
            return
        ground = soil_for(buildings[uid])
        if ground in sols:
            emit(ground, stage + "-sol")
        emit(uid, stage)

    # Jalon J1 de la transmission : Notre-Dame + son terrain.
    if PILOT_SOIL in sols:
        emit(PILOT_SOIL, "pilote-sol")
    emit_building(PILOT, "pilote-notre-dame")

    # Majeurs : ne pas attribuer de statut majeur par simple proximité.
    for uid in sorted(majors & buildings.keys(),
                      key=lambda u: (math.hypot(buildings[u][2], buildings[u][3]), u)):
        emit_building(uid, "patrimoine-majeur")

    # Zone centrale puis périphérie, dalle suivie de ses bâtiments.
    def dist(uid: str) -> tuple[float, str]:
        ix, iz = map(int, uid[4:].split("_"))
        return (math.hypot((ix + .5) * 200, (iz + .5) * 200), uid)

    for ground in sorted(sols, key=dist):
        emit(ground, "ilot-sol")
        for uid in by_soil.get(ground, []):
            emit(uid, "ilot-batiment")

    # On ne fait pas disparaître les bâtiments sans dalle correspondante.
    for uid in sorted(buildings):
        emit(uid, "batiment-sans-dalle")
    assert len(ordered) == len(buildings) + len(sols)
    return ordered


def acceptance(uid: str, base: Path, retours: Path) -> dict:
    ret = directory(retours, uid)
    source = directory(base, uid)
    if not (ret / "unite.json").exists():
        return {"etat": "a_traiter"}
    if not (source / "unite.json").exists():
        return {"etat": "base_absente", "raison": "Export de base nécessaire avant contrôle"}
    # Le validateur original fait foi ; aucun contournement ni approbation implicite.
    from check_unit_return import check
    report = check(ret, base)
    return {"etat": "acceptee" if report["accepte"] else "refusee",
            "erreurs": report.get("erreurs", []),
            "avertissements": report.get("avertissements", [])}


def prepare(uid: str, base: Path, catalogue: dict | None = None) -> dict:
    typ, value = parse_id(uid)
    from export_units import main
    args = ["--sortie", str(base)]
    args.extend(["--bat", value] if typ == "bat" else ["--sol", value])
    if main(args) != 0:
        raise RuntimeError("Échec d'export " + uid)
    target = directory(base, uid) / "unite.json"
    if not target.is_file():
        raise RuntimeError("L'unité demandée est absente après l'export : " + uid)
    doc = json.loads(target.read_text(encoding="utf8"))
    if doc["id"] != uid:
        raise ValueError("Identité différente après export")
    if catalogue is not None and typ == "bat":
        row = next((r for r in catalogue["batiments"] if r[0] == uid), None)
        if row is None or row[4] != doc["versionBase"]:
            raise ValueError("Version de l'unité discordante avec le catalogue")
    return {"unite": uid, "versionBase": doc["versionBase"],
            "base": str(target.parent), "etat": "base_exportee"}


def doctor(catalogue: Path) -> dict:
    executable = {name: shutil.which(name) for name in
                  ("pdal", "roofer", "blender", "gltfpack")}
    modules = {}
    for name in ("rasterio", "numpy", "shapely", "pyproj"):
        modules[name] = importlib.util.find_spec(name) is not None
    return {"cataloguePresent": catalogue.is_file(),
            "producteurs": executable, "bibliotheques": modules,
            "indispensablePourJ1": ["pdal", "roofer"],
            "note": "Un outil présent ne prouve pas la disponibilité des dalles LiDAR IGN. "
                    "Aucune sortie photoréaliste n'est présumée."}


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--base", type=Path, default=BASE)
    ap.add_argument("--retours", type=Path, default=RETURNS)
    ap.add_argument("--catalogue", type=Path, default=CATALOGUE)
    ap.add_argument("--patrimoine", type=Path, default=FOOTPRINTS)
    sub = ap.add_subparsers(dest="action", required=True)
    sub.add_parser("doctor")
    q = sub.add_parser("queue")
    q.add_argument("--limit", type=int, default=12)
    q.add_argument("--inclure-acceptes", action="store_true")
    sub.add_parser("prepare").add_argument("unite")
    sub.add_parser("validate").add_argument("unite")
    args = ap.parse_args(argv)
    try:
        if args.action == "doctor":
            result = doctor(args.catalogue)
        elif args.action == "prepare":
            result = prepare(args.unite, args.base)
        elif args.action == "validate":
            result = {"unite": args.unite, **acceptance(args.unite, args.base, args.retours)}
        else:
            if args.limit < 1 or args.limit > 10000:
                raise ValueError("--limit doit être compris entre 1 et 10000")
            data = load_catalogue(args.catalogue)
            ordered = plan(data, known_majors(args.patrimoine))
            tasks = []
            for uid, phase in ordered:
                state = acceptance(uid, args.base, args.retours)
                if state["etat"] == "acceptee" and not args.inclure_acceptes:
                    continue
                tasks.append({"id": uid, "phase": phase, **state})
                if len(tasks) >= args.limit:
                    break
            result = {
                "schema": "paris-matieres/plan-1",
                "batiments": len(data["batiments"]),
                "sols": len(data["sols"]),
                "aExaminer": len(ordered),
                "affiches": len(tasks),
                "taches": tasks,
                "precision": "Pas de téléchargement, rendu ni validation des données IGN dans cette commande."
            }
        print(json.dumps(result, ensure_ascii=False, indent=2))
        return 1 if args.action == "validate" and result["etat"] != "acceptee" else 0
    except (OSError, ValueError, RuntimeError, KeyError) as e:
        print(json.dumps({"erreur": str(e), "action": args.action}, ensure_ascii=False), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
