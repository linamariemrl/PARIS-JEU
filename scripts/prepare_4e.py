#!/usr/bin/env python3
"""Données réelles du 4e arrondissement. À exécuter dans GitHub Actions.

Bâtiments et hauteurs : IGN BD TOPO WFS. Limite : Ville de Paris.
En cas d'absence des données, aucune géométrie imaginaire n'est produite.
"""
from __future__ import annotations
import json
import math
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError
from shapely.geometry import box, shape, mapping
from shapely.ops import unary_union

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public" / "data" / "4e"
TILES = DEST / "tiles"
CENTER_LON, CENTER_LAT = 2.3537, 48.8545
METERS_X = 111320 * math.cos(math.radians(CENTER_LAT))
METERS_Z = 111132
TILE_METERS = 300
IGN_WFS = "https://data.geopf.fr/wfs/ows"
PARIS_API = "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/arrondissements/records"

def request_json(url: str, retries: int = 4) -> dict:
    for attempt in range(retries):
        try:
            req = Request(url, headers={
                "User-Agent": "PARIS-city-game/0.1 (non-commercial, GitHub Actions)",
                "Accept": "application/json",
            })
            with urlopen(req, timeout=55) as response:
                data = json.load(response)
            if not isinstance(data, dict):
                raise ValueError("Réponse JSON invalide")
            return data
        except (HTTPError, URLError, TimeoutError, ValueError) as exc:
            if attempt == retries - 1:
                raise RuntimeError("Données officielles indisponibles : " + str(exc)) from exc
            time.sleep(1 + 2**attempt)
    raise RuntimeError("Échec des requêtes")

def fourth_boundary():
    url = PARIS_API + "?" + urlencode({"where": "c_ar=4", "limit": 1})
    rows = request_json(url).get("results", [])
    if len(rows) != 1 or int(rows[0].get("c_ar", -1)) != 4:
        raise RuntimeError("Limite officielle du quatrième arrondissement introuvable")
    raw = rows[0].get("geom")
    if not isinstance(raw, dict):
        raise RuntimeError("Géométrie absente dans la réponse de Paris Data")
    geom = shape(raw)
    if not geom.is_valid:
        geom = geom.buffer(0)
    if geom.is_empty or not geom.is_valid:
        raise RuntimeError("Limite administrative invalide")
    min_lon, min_lat, max_lon, max_lat = geom.bounds
    if not (2.32 < min_lon < 2.38 and 48.83 < min_lat < 48.88 and max_lon < 2.4):
        raise RuntimeError("Limite du 4e suspecte : " + str(geom.bounds))
    return geom

def ll_to_xy(lon: float, lat: float):
    return (lon - CENTER_LON) * METERS_X, (lat - CENTER_LAT) * METERS_Z

def xy_to_ll(x: float, z: float):
    return CENTER_LON + x / METERS_X, CENTER_LAT + z / METERS_Z

def tile_bounds(ix: int, iz: int):
    a = xy_to_ll(ix * TILE_METERS, iz * TILE_METERS)
    b = xy_to_ll((ix + 1) * TILE_METERS, (iz + 1) * TILE_METERS)
    return a[0], a[1], b[0], b[1]

def fetch_ign(bbox):
    seen_first = set()
    count = 400
    for page in range(25):
        params = {
            "SERVICE": "WFS", "VERSION": "2.0.0", "REQUEST": "GetFeature",
            "TYPENAMES": "BDTOPO_V3:batiment", "SRSNAME": "CRS:84",
            "BBOX": ",".join(f"{v:.8f}" for v in bbox) + ",CRS:84",
            "COUNT": count, "STARTINDEX": page * count,
            "OUTPUTFORMAT": "application/json",
        }
        data = request_json(IGN_WFS + "?" + urlencode(params))
        features = data.get("features")
        if data.get("type") != "FeatureCollection" or not isinstance(features, list):
            raise RuntimeError("Réponse IGN WFS non GeoJSON")
        if features:
            first = str(features[0].get("id") or features[0].get("properties", {}).get("cleabs"))
            if first in seen_first:
                raise RuntimeError("Pagination IGN répétée et potentiellement incomplète")
            seen_first.add(first)
        yield from features
        if len(features) < count:
            return
        time.sleep(0.18)
    raise RuntimeError("Pagination IGN dépassant les limites de sécurité")

def encode_polygons(geom):
    polygons = [geom] if geom.geom_type == "Polygon" else (
        list(geom.geoms) if geom.geom_type == "MultiPolygon" else [])
    out = []
    for poly in polygons:
        if poly.is_empty or poly.area < 1e-11:
            continue
        rings = []
        for ring in [poly.exterior, *poly.interiors]:
            coords = [[round(coord[0], 7), round(coord[1], 7)] for coord in ring.coords]
            if len(coords) >= 4:
                rings.append(coords)
        if rings:
            out.append(rings)
    return out

def clean_feature(raw, boundary, ix: int, iz: int):
    geo = raw.get("geometry")
    if not geo:
        return None
    geom = shape(geo)
    if geom.is_empty or geom.geom_type not in ("Polygon", "MultiPolygon"):
        return None
    if not geom.is_valid:
        geom = geom.buffer(0)
    if not geom.intersects(boundary):
        return None
    clipped = geom.intersection(boundary)
    if clipped.is_empty:
        return None
    if clipped.geom_type not in ("Polygon", "MultiPolygon"):
        candidates = [g for g in getattr(clipped, "geoms", [])
                      if g.geom_type in ("Polygon", "MultiPolygon")]
        if not candidates:
            return None
        clipped = unary_union(candidates)
    centroid = clipped.representative_point()
    x, z = ll_to_xy(centroid.x, centroid.y)
    if math.floor(x / TILE_METERS) != ix or math.floor(z / TILE_METERS) != iz:
        return None
    polygons = encode_polygons(clipped.simplify(0.000002, preserve_topology=True))
    if not polygons:
        return None
    props = raw.get("properties") or {}
    raw_height = props.get("hauteur")
    try:
        height = float(raw_height)
    except (ValueError, TypeError):
        height = 0
    estimated = not (math.isfinite(height) and 2 <= height <= 220)
    if estimated:
        height = 15.0
    identifier = str(props.get("cleabs") or raw.get("id") or "").strip()
    if not identifier:
        raise RuntimeError("Bâtiment IGN sans identifiant")
    return {
        "id": identifier, "height": round(height, 2),
        "estimatedHeight": estimated,
        "usage": str(props.get("usage_1") or props.get("nature") or "Non renseigné"),
        "polygons": polygons,
    }

def main():
    boundary = fourth_boundary()
    DEST.mkdir(parents=True, exist_ok=True)
    TILES.mkdir(parents=True, exist_ok=True)
    (DEST / "boundary.geojson").write_text(json.dumps({
        "type": "Feature", "properties": {"c_ar": 4, "source": "Ville de Paris"},
        "geometry": mapping(boundary),
    }, ensure_ascii=False), encoding="utf-8")
    min_lon, min_lat, max_lon, max_lat = boundary.bounds
    min_x, min_z = ll_to_xy(min_lon, min_lat)
    max_x, max_z = ll_to_xy(max_lon, max_lat)
    for old in TILES.glob("*.json"):
        old.unlink()
    tiles = []
    seen = set()
    total = 0
    for iz in range(math.floor(min_z / TILE_METERS), math.floor(max_z / TILE_METERS) + 1):
        for ix in range(math.floor(min_x / TILE_METERS), math.floor(max_x / TILE_METERS) + 1):
            bbox = tile_bounds(ix, iz)
            if not box(*bbox).intersects(boundary):
                continue
            buildings = []
            for feature in fetch_ign(bbox):
                building = clean_feature(feature, boundary, ix, iz)
                if not building:
                    continue
                if building["id"] in seen:
                    raise RuntimeError("Doublon IGN détecté : " + building["id"])
                seen.add(building["id"])
                buildings.append(building)
            if not buildings:
                continue
            name = f"{ix}_{iz}"
            (TILES / f"{name}.json").write_text(json.dumps({
                "schema": 1, "id": name, "buildings": buildings,
            }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
            tiles.append({"id": name, "ix": ix, "iz": iz, "count": len(buildings)})
            total += len(buildings)
            print(f"{name}: {len(buildings)} bâtiments", flush=True)
            time.sleep(0.2)
    if total < 100 or len(tiles) < 4:
        raise RuntimeError(f"Extraction incomplète : {total} bâtiments en {len(tiles)} tuiles")
    (DEST / "manifest.json").write_text(json.dumps({
        "schema": 1,
        "source": "IGN BD TOPO V3 / WFS Géoplateforme",
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "tileMeters": TILE_METERS, "center": [CENTER_LON, CENTER_LAT],
        "buildings": total, "tiles": tiles,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Extraction terminée : {total} bâtiments réels sur {len(tiles)} tuiles.")

if __name__ == "__main__":
    main()
