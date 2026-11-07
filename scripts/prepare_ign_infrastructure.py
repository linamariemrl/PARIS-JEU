#!/usr/bin/env python3
"""Source de secours officielle pour les voiries et eaux du 4e.

BD TOPO IGN (tronçon de route, surface hydrographique). Extraction WFS libre.
Les ponts sont issus du statut altimétrique des routes et, si nécessaire,
des franchissements du cours d'eau. L'élévation du tablier reste graphique.
"""
from __future__ import annotations
import json
import math
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode

from shapely.geometry import LineString, box, shape
from shapely.ops import transform, unary_union

from prepare_4e import IGN_WFS, ll_to_xy, request_json
from prepare_infrastructure import DEST, BOUNDARY, ROAD_WIDTHS, rings_for

def localize(geometry):
    return transform(lambda x, y, z=None: ll_to_xy(x, y), geometry)

def wfs_layer(layer, bbox):
    seen = set()
    count = 400
    for page in range(35):
        args = {
            "SERVICE": "WFS", "VERSION": "2.0.0", "REQUEST": "GetFeature",
            "TYPENAMES": f"BDTOPO_V3:{layer}",
            "SRSNAME": "CRS:84",
            "BBOX": ",".join(f"{v:.8f}" for v in bbox) + ",CRS:84",
            "COUNT": count, "STARTINDEX": page * count,
            "OUTPUTFORMAT": "application/json",
        }
        result = request_json(IGN_WFS + "?" + urlencode(args))
        features = result.get("features")
        if not isinstance(features, list):
            raise RuntimeError("Réponse IGN non GeoJSON pour " + layer)
        for feature in features:
            ident = str(feature.get("id") or (feature.get("properties") or {}).get("cleabs"))
            if ident in seen:
                raise RuntimeError("Pagination IGN incorrecte: " + ident)
            seen.add(ident)
            yield feature
        if len(features) < count:
            break
        time.sleep(0.2)
    else:
        raise RuntimeError("Nombre de pages IGN excessif: " + layer)

def flatten_lines(geom):
    if geom.is_empty:
        return []
    if geom.geom_type in ("LineString", "LinearRing"):
        return [geom]
    if geom.geom_type in ("MultiLineString", "GeometryCollection"):
        return [g for part in geom.geoms for g in flatten_lines(part)]
    return []

def flatten_polygons(geom):
    if geom.is_empty:
        return []
    if geom.geom_type == "Polygon":
        return [geom]
    if geom.geom_type in ("MultiPolygon", "GeometryCollection"):
        return [g for part in geom.geoms for g in flatten_polygons(part)]
    return []

def width(props):
    try:
        val = float(str(props.get("largeur_de_chaussee") or "").replace(",", "."))
        if math.isfinite(val) and 1 <= val <= 40:
            return val
    except (ValueError, TypeError):
        pass
    return 6.0

def road_is_bridge(props):
    value = props.get("position_par_rapport_au_sol")
    try:
        if value is not None and float(value) > 0:
            return True
    except (ValueError, TypeError):
        pass
    nature = str(props.get("nature", "")).lower()
    return "pont" in nature or "viaduc" in nature

def main():
    if not BOUNDARY.is_file():
        raise RuntimeError("Limite du 4e indisponible")
    boundary = shape(json.loads(BOUNDARY.read_text(encoding="utf-8"))["geometry"])
    w, s, e, n = boundary.bounds
    pad = 0.0023
    bbox = (w - pad, s - pad, e + pad, n + pad)
    ax, az = ll_to_xy(bbox[0], bbox[1])
    bx, bz = ll_to_xy(bbox[2], bbox[3])
    extent = box(ax, az, bx, bz)
    water_parts = []
    for feature in wfs_layer("surface_hydrographique", bbox):
        geom = feature.get("geometry")
        if not geom:
            continue
        g = localize(shape(geom))
        if not g.is_valid:
            g = g.buffer(0)
        if g.intersects(extent):
            water_parts.extend(flatten_polygons(g.intersection(extent)))
    if not water_parts:
        raise RuntimeError("Aucune surface hydrographique IGN trouvée autour du 4e")
    water = unary_union(water_parts)
    if water.area < 5000:
        raise RuntimeError("Surface IGN insuffisante pour représenter la Seine")
    groups = {k: [] for k in ("water", "bank", "sidewalk", "road", "foot", "square", "bridge")}
    groups["water"].append(water)
    names = []
    roads = 0
    bridges = 0
    for feature in wfs_layer("troncon_de_route", bbox):
        geom = feature.get("geometry")
        if not geom:
            continue
        properties = feature.get("properties") or {}
        g = localize(shape(geom))
        if not g.intersects(extent):
            continue
        nature = str(properties.get("nature") or "").lower()
        walking = any(word in nature for word in ("sentier", "escalier", "chemin", "piste cyclable"))
        measured = width(properties)
        if walking and measured == 6:
            measured = 2.5
        for line in flatten_lines(g.intersection(extent)):
            if line.length < 1:
                continue
            roads += 1
            corridor = line.buffer(measured/2, cap_style=2, join_style=2)
            # Un franchissement au-dessus de l'eau reste signalé comme tel,
            # même lorsque l'attribut altimétrique IGN est incomplet.
            crosses = line.intersection(water).length > min(9, line.length * 0.22)
            if road_is_bridge(properties) or crosses:
                groups["bridge"].append(line.buffer((measured+1.4)/2, cap_style=2, join_style=2))
                bridges += 1
                names.append({"id":str(properties.get("cleabs") or feature.get("id")),
                              "name":str(properties.get("nom_collaboratif") or ""),
                              "width": round(measured,1)})
            elif walking:
                groups["foot"].append(corridor)
            else:
                groups["road"].append(corridor)
                groups["sidewalk"].append(line.buffer(measured/2+1.85, cap_style=2, join_style=2))
    if roads < 80 or bridges < 2:
        raise RuntimeError(f"Réseau IGN incomplet : {roads} routes, {bridges} franchissements")
    groups["bank"].append(water.boundary.buffer(1.75).difference(water).intersection(extent))
    layers = {}
    for kind, shapes in groups.items():
        merged = unary_union([g for g in shapes if not g.is_empty])
        layers[kind] = rings_for(merged.intersection(extent).simplify(0.12, preserve_topology=True))
    if not layers["water"] or not layers["road"] or not layers["bridge"]:
        raise RuntimeError("Données officielles de voirie/eau incomplètes")
    payload = {
        "schema":1, "source":"IGN BD TOPO V3",
        "sourceUrl":"https://geoservices.ign.fr/bdtopo",
        "license":"Licence Ouverte 2.0",
        "extractedAt":datetime.now(timezone.utc).isoformat(),
        "waterApproximate":False, "widthsApproximate":True,
        "counts":{"ways":roads,"roads":roads,"bridges":bridges,"waterPolygons":len(water_parts)},
        "bridges":names, "layers":layers,
    }
    DEST.parent.mkdir(parents=True, exist_ok=True)
    temp = DEST.with_suffix(".tmp")
    temp.write_text(json.dumps(payload,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    temp.replace(DEST)
    print(f"IGN: {roads} tronçons, {bridges} ponts, {len(water_parts)} polygones d'eau, "
          f"{DEST.stat().st_size} octets.")

if __name__ == "__main__":
    main()
