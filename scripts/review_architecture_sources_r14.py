#!/usr/bin/env python3
"""R14 - Audit hors ligne de sources photographiques et plans d'architecture.

Ce registre n'est pas une preuve de photogrammétrie. Le contrôle refuse les
sources fermées, les poses prétendument mesurées sans données de contrôle et
toute promotion prématurée d'une maquette dans le jeu public.
Aucune image n'est téléchargée par ce programme.
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
from pathlib import Path
from urllib.parse import urlsplit

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "public/data/metropole/architecture/evidence/PA00086319-open-views-r14.json"
REGISTRATION = ROOT / "public/data/metropole/architecture/registration/PA00086319.json"
MODEL_INDEX = ROOT / "public/data/metropole/architecture/models/index.json"
ALLOWED_LICENSES = {"CC0-1.0", "CC-BY-SA-3.0", "CC-BY-SA-4.0", "public-domain"}
ALLOWED_HOSTS = {"commons.wikimedia.org", "bibliotheques-specialisees.paris.fr"}


def read(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def review(manifest: dict, registration: dict, index: dict) -> dict:
    """Validation des faits déclarés ; aucune certification géométrique."""
    errors: list[str] = []
    if manifest.get("schema") != "paris-architecture-evidence/1":
        errors.append("schema de registre inconnu")
    ref = manifest.get("ref")
    if not isinstance(ref, str) or not ref.startswith("PA") or len(ref) != 10:
        errors.append("reference POP invalide")
    if registration.get("ref") != ref:
        errors.append("registre et fiche de calage incompatibles")
    if registration.get("status") != "unregistered" or any(
        registration.get(key) is not None for key in ("originL93", "transform", "rmsControlMeters")
    ) or registration.get("tiePoints") or registration.get("controlPoints"):
        errors.append("la fiche de calage n'est plus inerte : revoir le protocole")
    if index.get("schema") != 1 or any(
        row.get("ref") == ref for row in index.get("models", [])
    ):
        errors.append("un modele est declare integre sans certification R14")
    declared = manifest.get("registration")
    if not isinstance(declared, dict) or declared.get("status") != "unregistered" or any(
        declared.get(field) is not False if field == "modelPublished"
        else declared.get(field) != 0
        for field in ("verifiedTiePoints", "independentControlPoints",
                      "verifiedExtrinsicCameraPoses", "triangulatedSegments", "modelPublished")
    ):
        errors.append("la provenance ne permet pas de declarer une geometrie mesuree")
    if manifest.get("status") != "source-verified-unregistered":
        errors.append("statut excessif pour un inventaire non calibre")
    if not isinstance(manifest.get("unknowns"), list) or len(manifest["unknowns"]) < 4:
        errors.append("incertitudes non documentees")

    sources = manifest.get("sources")
    if not isinstance(sources, list):
        sources = []
        errors.append("sources absentes")
    seen: set[str] = set()
    photos = 0
    plans = 0
    camera_positions = 0
    for index_number, source in enumerate(sources, 1):
        if not isinstance(source, dict):
            errors.append(f"source {index_number} non structuree")
            continue
        sid = source.get("id")
        if not isinstance(sid, str) or not sid or sid in seen:
            errors.append(f"source {index_number} avec identifiant absent ou duplique")
        else:
            seen.add(sid)
        if source.get("license") not in ALLOWED_LICENSES:
            errors.append(f"source {sid}: licence interdite ou non verifiee")
        try:
            url = urlsplit(source.get("sourcePage", ""))
            if url.scheme != "https" or url.hostname not in ALLOWED_HOSTS:
                raise ValueError("host")
        except (TypeError, ValueError):
            errors.append(f"source {sid}: origine ou protocole non approuves")
        if not isinstance(source.get("author"), str) or not source["author"].strip():
            errors.append(f"source {sid}: attribution absente")
        if not isinstance(source.get("usage"), str) or not source["usage"].strip():
            errors.append(f"source {sid}: emploi documentaire non qualifie")
        if source.get("cameraPoseVerified") is not False or source.get("cameraBearingDeg") is not None:
            errors.append(f"source {sid}: pose de camera annoncee sans calibration")
        if type(source.get("featureMatchesMeasured")) is not int or source["featureMatchesMeasured"] != 0:
            errors.append(f"source {sid}: correspondances tridimensionnelles non controlees")
        kind = source.get("kind")
        if kind == "historical-plan":
            plans += 1
            if source.get("captured") != "1878" or source.get("cameraPositionWgs84") is not None:
                errors.append(f"source {sid}: le plan historique ne donne pas une pose actuelle")
        elif kind == "current-photograph":
            photos += 1
            try:
                date = dt.date.fromisoformat(source["captured"])
                if not (2000 <= date.year <= 2026):
                    raise ValueError("date hors corpus")
            except (TypeError, ValueError, KeyError):
                errors.append(f"source {sid}: date photographique invalide")
            coordinates = source.get("cameraPositionWgs84")
            if coordinates is not None:
                if (not isinstance(coordinates, list) or len(coordinates) != 2 or
                    any(type(v) not in (int, float) for v in coordinates) or
                    not (2.15 <= coordinates[0] <= 2.55 and
                         48.75 <= coordinates[1] <= 48.97)):
                    errors.append(f"source {sid}: position de camera impossible")
                else:
                    camera_positions += 1
        else:
            errors.append(f"source {sid}: type inconnu")
    if plans < 1 or photos < 3:
        errors.append("corpus documentaire initial insuffisant")
    return {
        "reference": ref,
        "status": "invalid" if errors else "sources-documented-not-triangulated",
        "sourceCount": len(sources),
        "photoCount": photos,
        "historicalPlanCount": plans,
        "publishedCameraPositions": camera_positions,
        "calibratedCameraPoses": 0,
        "certifiedSegments": 0,
        "nextStep": "reperer des points correspondants et des points de controle EPSG:2154 independants",
        "errors": errors
    }


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("--manifest", type=Path, default=MANIFEST)
    p.add_argument("--registration", type=Path, default=REGISTRATION)
    p.add_argument("--models", type=Path, default=MODEL_INDEX)
    args = p.parse_args()
    result = review(read(args.manifest), read(args.registration), read(args.models))
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 1 if result["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
