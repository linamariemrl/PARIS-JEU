#!/usr/bin/env python3
"""Extraire les noms de rues sourcés de l'IGN BD TOPO (sans toponymes inventés).

Les noms sont pris uniquement dans les champs odonymiques documentés des tronçons.
Chaque rue nommée a au moins un point d'ancrage ; les rues longues en ont plusieurs.
Le rendu peut répartir les textes en cas de chevauchement à petite échelle.
"""
from __future__ import annotations

import json
import math
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from shapely.geometry import box, shape
from shapely.ops import transform

from prepare_4e import ll_to_xy
from prepare_ign_infrastructure import BOUNDARY, wfs_layer, flatten_lines

DEST = Path(__file__).resolve().parents[1] / "public/data/4e/street-names.json"
FIELDS = (
    "nom_ban_g", "nom_ban_d", "nom_ban_gauche", "nom_ban_droite",
    "nom_collaboratif_gauche", "nom_collaboratif_droite",
    "nom_collaboratif_g", "nom_collaboratif_d",
    "cpx_toponyme_route_nommee", "nom_voie_ban_g", "nom_voie_ban_d",
    "nom_1_g", "nom_1_d", "toponyme",
)
INVALID = {"", "sans valeur", "inconnu", "indéterminé", "non renseigné", "none", "null", "nc", "nr"}

def normalize(value):
    if not isinstance(value, str):
        return None
    value = " ".join(value.replace("\x00", " ").split()).strip()
    return value if 2 <= len(value) <= 110 and value.casefold() not in INVALID else None

def names(props):
    found = []
    for key in FIELDS:
        name = normalize(props.get(key))
        if name and name.casefold() not in [n.casefold() for n in found]:
            found.append(name)
    return found

def anchor(line):
    mid = line.interpolate(0.5, normalized=True)
    delta = min(max(2., line.length * 0.06), 9.)
    a = line.interpolate(max(0., line.length / 2 - delta))
    b = line.interpolate(min(line.length, line.length / 2 + delta))
    angle = math.degrees(math.atan2(b.y-a.y, b.x-a.x))
    return [round(mid.x, 1), round(mid.y, 1), round(angle, 1)]

def candidates(features, extent):
    by_name = defaultdict(list)
    named_sections = 0
    unnamed_sections = 0
    for feat in features:
        geom = feat.get("geometry")
        if not geom:
            continue
        props = feat.get("properties") or {}
        nms = names(props)
        if not nms:
            unnamed_sections += 1
            continue
        g = transform(lambda x, y, z=None: ll_to_xy(x, y), shape(geom))
        if not g.intersects(extent):
            continue
        for line in flatten_lines(g.intersection(extent)):
            if line.length < 5:
                continue
            named_sections += 1
            for name in nms[:2]:
                by_name[name].append(line)
    points = []
    for name, lines in sorted(by_name.items()):
        # Un point obligatoire par dénomination, même pour une voie très courte.
        lines.sort(key=lambda l: l.length, reverse=True)
        chosen = [lines[0]]
        for line in lines[1:]:
            if len(chosen) >= 12:
                break
            mid = line.interpolate(0.5, normalized=True)
            if all(mid.distance(other.interpolate(0.5, normalized=True)) >= 125 for other in chosen):
                chosen.append(line)
        for i, line in enumerate(chosen):
            x, z, angle = anchor(line)
            points.append({"id": f"{name}|{i}", "name": name, "x": x, "z": z, "angle": angle, "length": round(line.length)})
    return points, len(by_name), named_sections, unnamed_sections

def main():
    boundary = shape(json.loads(BOUNDARY.read_text(encoding="utf-8"))["geometry"])
    west, south, east, north = boundary.bounds
    padding = 0.0012
    bbox = west-padding, south-padding, east+padding, north+padding
    x0,z0 = ll_to_xy(bbox[0],bbox[1])
    x1,z1 = ll_to_xy(bbox[2],bbox[3])
    points, unique, sections, missing = candidates(wfs_layer("troncon_de_route", bbox), box(x0,z0,x1,z1))
    if unique < 80 or len(points) < 100:
        raise RuntimeError(f"Relevé odonymique insuffisant : {unique} rues, {len(points)} étiquettes")
    data = {
        "schema": 1,
        "source": "IGN BD TOPO V3, noms de voies",
        "sourceUrl": "https://geoservices.ign.fr/bdtopo",
        "extractedAt": datetime.now(timezone.utc).isoformat(),
        "namedStreets": unique,
        "namedSections": sections,
        "unnamedSections": missing,
        "count": len(points),
        "labels": points
    }
    DEST.parent.mkdir(parents=True, exist_ok=True)
    temp = DEST.with_suffix(".tmp")
    temp.write_text(json.dumps(data, ensure_ascii=False, separators=(",",":")),encoding="utf-8")
    temp.replace(DEST)
    print(f"Noms IGN extraits : {unique} voies nommées, {len(points)} positions, {missing} tronçons sans nom.")
if __name__ == "__main__":
    main()
