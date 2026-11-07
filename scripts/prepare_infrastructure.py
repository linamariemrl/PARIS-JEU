#!/usr/bin/env python3
"""Prépare les rues, places, ponts et eaux du 4e depuis OpenStreetMap.

Extraction ponctuelle par GitHub Actions. Les géométries ne sont jamais inventées.
Toutes les coordonnées exportées sont en mètres, dans le repère du moteur 3D.
Les largeurs par défaut sont des conventions graphiques, pas des mesures terrain.
"""
from __future__ import annotations

import json
import math
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from shapely.geometry import LineString, Polygon, box, shape
from shapely.ops import transform, unary_union
from shapely.validation import explain_validity

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public" / "data" / "4e" / "infrastructure.json"
BOUNDARY = DEST.parent / "boundary.geojson"
CX, CZ = 2.3537, 48.8545
MX = 111320 * math.cos(math.radians(CZ))
MZ = 111132

ENDPOINTS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
]
ROAD_WIDTHS = {
    "motorway": 20, "trunk": 15, "primary": 12, "secondary": 10,
    "tertiary": 8, "residential": 6, "living_street": 5,
    "service": 3.5, "unclassified": 6, "pedestrian": 4,
    "cycleway": 2.5, "footway": 2.2, "path": 2, "steps": 2.3,
    "track": 3, "corridor": 2, "busway": 6,
}
WALKING = {"pedestrian", "footway", "path", "steps", "cycleway", "corridor"}
MAX_FEATURES = 12000

def local(x, y, z=None):
    return (x - CX) * MX, (y - CZ) * MZ

def read_boundary():
    if not BOUNDARY.is_file():
        raise RuntimeError("Limite du 4e absente : exécuter d'abord prepare_4e.py")
    geo = json.loads(BOUNDARY.read_text(encoding="utf-8"))
    boundary = shape(geo["geometry"])
    if boundary.is_empty or not boundary.is_valid:
        raise RuntimeError("Limite du 4e invalide")
    return boundary

def query_for(bbox):
    w, s, e, n = bbox
    bb = ",".join(f"{v:.6f}" for v in (s, w, n, e))
    return (
        "[out:json][timeout:150];("
        f'way["highway"]({bb});'
        f'way["natural"="water"]({bb});'
        f'way["waterway"~"^(river|riverbank|canal)$"]({bb});'
        f'way["water"~"^(river|canal)$"]({bb});'
        f'relation["natural"="water"]({bb});'
        f'relation["waterway"="riverbank"]({bb});'
        ");out geom;"
    )

def get_osm(bbox):
    query = query_for(bbox)
    errors = []
    for endpoint in ENDPOINTS:
        for attempt in range(2):
            try:
                body = urlencode({"data": query}).encode("utf-8")
                req = Request(endpoint, data=body, headers={
                    "User-Agent": "PARIS-3D-Geodata/0.2 (GitHub Actions, non-commercial)",
                    "Accept": "application/json",
                    "Content-Type": "application/x-www-form-urlencoded",
                })
                with urlopen(req, timeout=180) as response:
                    result = json.load(response)
                elements = result.get("elements")
                if not isinstance(elements, list) or len(elements) > MAX_FEATURES:
                    raise ValueError("Volume OSM inattendu")
                if len(elements) < 80:
                    raise ValueError("Réponse OSM trop petite")
                return elements, endpoint
            except (HTTPError, URLError, TimeoutError, ValueError, OSError) as exc:
                errors.append(f"{endpoint}: {exc}")
                time.sleep(2 + attempt * 3)
    raise RuntimeError("Extraction OSM indisponible : " + "; ".join(errors))

def is_closed(coords):
    return len(coords) >= 4 and coords[0] == coords[-1]

def polygon_parts(geom):
    if geom.is_empty:
        return []
    if geom.geom_type == "Polygon":
        return [geom]
    if geom.geom_type in ("MultiPolygon", "GeometryCollection"):
        return [p for g in geom.geoms for p in polygon_parts(g)]
    return []

def rings_for(geom):
    result = []
    for poly in polygon_parts(geom):
        if poly.area < 0.2:
            continue
        rings = []
        for boundary in [poly.exterior, *poly.interiors]:
            coords = [[round(x, 2), round(y, 2)] for x, y in boundary.coords]
            if len(coords) >= 4:
                rings.append(coords)
        if rings:
            result.append(rings)
    return result

def width_of(tags, kind):
    default = ROAD_WIDTHS[kind]
    raw = str(tags.get("width", "")).lower().replace(",", ".").strip()
    match = re.fullmatch(r"(\d+(?:\.\d+)?)\s*(?:m|metres?|meters?)?", raw)
    if match:
        measured = float(match.group(1))
        if 0.7 <= measured <= 50:
            return measured
    lanes = str(tags.get("lanes", ""))
    if not kind in WALKING and lanes.isdigit() and 1 <= int(lanes) <= 8:
        return max(default, int(lanes) * 3.0)
    return default

def osm_line(geometry):
    coords = [(p["lon"], p["lat"]) for p in geometry
              if isinstance(p, dict) and "lon" in p and "lat" in p]
    if len(coords) < 2:
        return None
    return transform(local, LineString(coords))

def osm_poly(geometry):
    coords = [(p["lon"], p["lat"]) for p in geometry
              if isinstance(p, dict) and "lon" in p and "lat" in p]
    if not is_closed(coords):
        return None
    poly = transform(local, Polygon(coords))
    if not poly.is_valid:
        poly = poly.buffer(0)
    return poly if not poly.is_empty else None

def collect(elements, extent):
    # Couche indépendante des bâtiments. Les ponts sont de vrais tronçons OSM
    # (bridge=yes/viaduct), avec surélévation graphique non topographique.
    groups = {k: [] for k in ("road", "sidewalk", "foot", "square", "bridge", "water")}
    bridges = []
    waterways = []
    counts = {"ways": 0, "roads": 0, "bridges": 0, "waterPolygons": 0}
    for item in elements:
        if item.get("type") != "way":
            continue
        geometry = item.get("geometry") or []
        tags = item.get("tags") or {}
        kind = tags.get("highway")
        if kind in ROAD_WIDTHS:
            line = osm_line(geometry)
            if line is None or not line.intersects(extent):
                continue
            counts["ways"] += 1
            width = width_of(tags, kind)
            if tags.get("area") == "yes" and is_closed([(v["lon"], v["lat"]) for v in geometry]):
                area = osm_poly(geometry)
                if area is not None and kind in WALKING:
                    groups["square"].append(area.intersection(extent))
                    continue
            line = line.intersection(extent)
            if line.is_empty or line.length < 0.8:
                continue
            surface = line.buffer(width / 2, cap_style=2, join_style=2)
            if tags.get("bridge") not in (None, "no", "false", "0") or tags.get("man_made") == "bridge":
                groups["bridge"].append(line.buffer((width + 1.4) / 2, cap_style=2, join_style=2))
                counts["bridges"] += 1
                bridges.append({
                    "id": str(item.get("id")), "name": str(tags.get("name", "")),
                    "width": round(width, 1),
                })
            elif kind in WALKING:
                groups["foot"].append(surface)
            else:
                groups["road"].append(surface)
                groups["sidewalk"].append(line.buffer(width / 2 + 1.85, cap_style=2, join_style=2))
            counts["roads"] += 1
        if tags.get("natural") == "water" or tags.get("waterway") == "riverbank" or tags.get("water") in ("river", "canal"):
            poly = osm_poly(geometry)
            if poly is not None and poly.intersects(extent):
                groups["water"].append(poly.intersection(extent))
                counts["waterPolygons"] += 1
        elif tags.get("waterway") in ("river", "canal"):
            line = osm_line(geometry)
            if line is not None and line.intersects(extent):
                waterways.append((line.intersection(extent), tags.get("waterway")))
    approximate_water = False
    if not groups["water"] and waterways:
        # Dernier recours uniquement si un axe hydrographique OSM réel existe.
        # La largeur est alors schématique et l'interface le précise.
        approximate_water = True
        groups["water"] = [
            line.buffer(36 if typ == "river" else 12, cap_style=2, join_style=2)
            for line, typ in waterways
        ]
    if not groups["water"]:
        raise RuntimeError("Aucune géométrie de Seine ou de canal issue d'OSM")
    if counts["roads"] < 80 or counts["bridges"] < 2:
        raise RuntimeError(f"Réseau OSM suspect : {counts}")
    # Les couches sont fusionnées afin de limiter les appels de rendu mobile.
    output = {}
    for kind, raw in groups.items():
        merged = unary_union([g for g in raw if not g.is_empty])
        if kind == "water":
            water = merged.intersection(extent)
            if water.area < 1000:
                raise RuntimeError("Surface d'eau OSM insuffisante")
        output[kind] = rings_for(merged.intersection(extent).simplify(0.12, preserve_topology=True))
    water_geometry = unary_union(groups["water"]).intersection(extent)
    banks = water_geometry.boundary.buffer(1.75).difference(water_geometry).intersection(extent)
    output["bank"] = rings_for(banks.simplify(0.12, preserve_topology=True))
    if not output["road"] or not output["water"] or not output["bridge"]:
        raise RuntimeError("Couches OSM essentielles vides")
    return output, bridges, counts, approximate_water

def main():
    boundary = read_boundary()
    w, s, e, n = boundary.bounds
    pad = 0.0023
    bbox = (w - pad, s - pad, e + pad, n + pad)
    elements, endpoint = get_osm(bbox)
    lx0, lz0 = local(bbox[0], bbox[1])
    lx1, lz1 = local(bbox[2], bbox[3])
    layers, bridges, counts, approximation = collect(elements, box(lx0, lz0, lx1, lz1))
    payload = {
        "schema": 1,
        "source": "© OpenStreetMap contributors",
        "license": "ODbL 1.0",
        "sourceUrl": "https://www.openstreetmap.org/copyright",
        "extractedAt": datetime.now(timezone.utc).isoformat(),
        "endpoint": endpoint,
        "extent": [round(lx0), round(lz0), round(lx1), round(lz1)],
        "waterApproximate": approximation,
        "widthsApproximate": True,
        "counts": counts, "bridges": bridges, "layers": layers,
    }
    DEST.parent.mkdir(parents=True, exist_ok=True)
    tmp = DEST.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tmp.replace(DEST)
    print(f"Voirie: {counts['roads']} tronçons, {counts['bridges']} ponts, "
          f"{len(layers['water'])} surfaces d'eau; fichier: {DEST.stat().st_size} octets")
    if approximation:
        print("ATTENTION : contour de l'eau approximé depuis les axes OSM")

if __name__ == "__main__":
    main()
