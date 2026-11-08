#!/usr/bin/env python3
"""Emprises réelles des chaussées du Plan de Voirie de Paris (PVP).

Ce dataset localise la voirie, mais ne renseigne PAS automatiquement
le matériau exact (asphalte, pavés...). La couleur est conventionnelle.
Le PVP ne doit pas être assimilé à un levé topographique.
"""
from __future__ import annotations
import json
import math
from datetime import datetime,timezone
from pathlib import Path
from urllib.request import Request,urlopen
from shapely.geometry import shape
from shapely.ops import transform

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/"public/data/metropole/surfaces/roads.json"
URL="https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/plan-de-voirie-chaussees/exports/geojson"
LON,LAT=2.3537,48.8545
MX=111320*math.cos(math.radians(LAT))
MZ=111132
MAX_DOWNLOAD=145_000_000


def download():
    req=Request(URL+"?"+ "select=objectid,geo_shape",headers={
        "User-Agent":"PARIS-SKYLINES-open-data/0.18",
        "Accept":"application/geo+json,application/json"})
    with urlopen(req,timeout=210) as response:
        chunks=[]
        size=0
        while True:
            chunk=response.read(1024*1024)
            if not chunk:break
            size+=len(chunk)
            if size>MAX_DOWNLOAD:
                raise ValueError("Export PVP trop volumineux : >145 Mo")
            chunks.append(chunk)
    result=json.loads(b"".join(chunks))
    if result.get("type")!="FeatureCollection" or not isinstance(
        result.get("features"),list):
        raise ValueError("L'export PVP ne contient pas de FeatureCollection")
    return result["features"]


def project(x,y,z=None):
    return ((x-LON)*MX,(y-LAT)*MZ)


def geometries(poly):
    if poly.is_empty:return []
    if poly.geom_type=="Polygon":return [poly]
    return [g for piece in getattr(poly,"geoms",[])
        for g in geometries(piece)]


def parse_feature(f):
    raw=f.get("geometry")
    if not raw or raw.get("type") not in ("Polygon","MultiPolygon"):
        props=f.get("properties") or {}
        raw=props.get("geo_shape")
        if isinstance(raw,str):
            try:raw=json.loads(raw)
            except json.JSONDecodeError:return []
    if not isinstance(raw,dict) or raw.get("type") not in ("Polygon","MultiPolygon"):
        return []
    geom=shape(raw)
    if geom.is_empty:return []
    if not geom.is_valid:geom=geom.buffer(0)
    metric=transform(project,geom).simplify(.40,preserve_topology=True)
    out=[]
    for poly in geometries(metric):
        if poly.area<3:continue
        rings=[]
        for r in [poly.exterior,*poly.interiors]:
            values=[[round(x,2),round(z,2)] for x,z in r.coords]
            if len(values)>=4:rings.append(values)
        if rings:out.append({"kind":"road","polygons":[rings]})
    return out


def main():
    rows=download()
    if not 10000<=len(rows)<=30000:
        raise ValueError("Échantillon chaussées PVP incomplet : "+str(len(rows)))
    features=[]
    for raw in rows:
        features.extend(parse_feature(raw))
    if len(features)<10000:
        raise ValueError("Géométries chaussées PVP insuffisantes : "+str(len(features)))
    data={
        "schema":1,"source":"Paris Data : Plan de voirie - Chaussées",
        "sourceUrl":"https://opendata.paris.fr/explore/dataset/plan-de-voirie-chaussees/",
        "license":"ODbL","extractedAt":datetime.now(timezone.utc).isoformat(),
        "count":len(features),"sourceRecords":len(rows),
        "note":"Emprises de chaussées, couleurs indicatives ; matériau de revêtement NON documenté par cette couche.",
        "features":features
    }
    DEST.parent.mkdir(parents=True,exist_ok=True)
    content=json.dumps(data,ensure_ascii=False,separators=(",",":"))
    if len(content.encode("utf-8"))>30_000_000:
        raise ValueError("Maillage trop volumineux pour Android ; simplification nécessaire")
    temp=DEST.with_suffix(".tmp")
    temp.write_text(content,encoding="utf-8")
    temp.replace(DEST)
    print(len(features),"chaussées PVP, taille",DEST.stat().st_size,flush=True)


if __name__=="__main__":
    main()
