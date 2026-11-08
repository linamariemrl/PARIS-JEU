#!/usr/bin/env python3
"""Espaces verts réellement publiés par Paris Data.

Ce sont les EMPRISES GÉOGRAPHIQUES des espaces municipaux, non la preuve
d'un gazon continu ni la cartographie des cheminements internes.
Aucune photographie ni génération de jardin par approximation.
"""
from __future__ import annotations
import json
import math
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from shapely.geometry import shape, box
from shapely.ops import transform, unary_union

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/"public/data/metropole/surfaces/green.json"
LIMITS=ROOT/"public/data/metropole/limits.geojson"
API="https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/espaces_verts/records"
LON,LAT=2.3537,48.8545
MX=111320*math.cos(math.radians(LAT))
MZ=111132


def get_json(url):
    last=None
    for retry in range(4):
        try:
            request=Request(url,headers={
                "Accept":"application/json",
                "User-Agent":"PARIS-SKYLINES-open-data/0.18"})
            with urlopen(request,timeout=80) as response:
                return json.load(response)
        except Exception as exc:
            last=exc
            if retry<3:time.sleep(1.5*(retry+1))
    raise RuntimeError("Téléchargement Paris Data impossible : "+str(last))


def records():
    total=None
    for offset in range(0,10000,100):
        result=get_json(API+"?"+urlencode({"limit":100,"offset":offset}))
        if total is None:
            total=int(result.get("total_count",0))
            if not 50<=total<=10000:
                raise ValueError("Nombre d'espaces verts hors limite : "+str(total))
        rows=result.get("results")
        if not isinstance(rows,list):
            raise ValueError("API Paris Data : liste de résultats absente")
        yield from rows
        if offset+len(rows)>=total:
            return
        time.sleep(.04)
    raise ValueError("Pagination espaces verts incomplète")


def projection(x,y,z=None):
    return (x-LON)*MX,(y-LAT)*MZ


def perimeter():
    data=json.loads(LIMITS.read_text(encoding="utf-8"))
    geoms=[shape(f["geometry"]) for f in data["features"]
      if f["properties"]["kind"] in ("paris","commune_limitrophe")]
    if len(geoms)<28:
        raise ValueError("Limites communales IGN insuffisantes")
    return unary_union(geoms)


def extract(row,metro):
    geometry=row.get("geom") or row.get("geo_shape")
    if isinstance(geometry,dict) and geometry.get("type")=="Feature":
        geometry=geometry.get("geometry")
    if not isinstance(geometry,dict):
        return []
    if geometry.get("type") not in ("Polygon","MultiPolygon"):
        return []
    area=shape(geometry)
    if not area.is_valid:area=area.buffer(0)
    if area.is_empty or not metro.intersects(area):
        return []
    overlap=metro.intersection(area)
    if overlap.is_empty:return []
    local=transform(projection,overlap)
    if not local.is_valid:local=local.buffer(0)
    local=local.simplify(.55,preserve_topology=True)
    pieces=[local] if local.geom_type=="Polygon" else (
        list(local.geoms) if local.geom_type=="MultiPolygon" else
        [g for g in getattr(local,"geoms",[]) if g.geom_type=="Polygon"])
    code=row.get("type_ev",row.get("code_type",row.get("type",None)))
    label=str(row.get("nom_ev") or row.get("nom") or "").lower()
    kind="managed"
    if str(code)=="10" or "bois de boulogne" in label or "bois de vincennes" in label:
        kind="wood"
    elif str(code) in ("2","3","11"):
        kind="planted"
    out=[]
    for p in pieces:
        if p.is_empty or p.area<3 or len(p.exterior.coords)<4:
            continue
        rings=[]
        for ring in [p.exterior,*p.interiors]:
            points=[[round(x,2),round(z,2)] for x,z in ring.coords]
            if len(points)>=4:rings.append(points)
        if rings:out.append({"kind":kind,"polygons":[rings]})
    return out


def main():
    metro=perimeter()
    features=[]
    count=0
    for row in records():
        count+=1
        features.extend(extract(row,metro))
    if len(features)<80:
        raise ValueError("Extraction des parcs insuffisante : "+str(len(features)))
    payload={
        "schema":1,"source":"Paris Data : espaces_verts",
        "sourceUrl":"https://opendata.paris.fr/explore/dataset/espaces_verts/",
        "license":"ODbL","extractedAt":datetime.now(timezone.utc).isoformat(),
        "count":len(features),"sourceRecords":count,
        "note":"Emprises municipales ; sous-surfaces et chemins non détaillés. Bois et jardins présents.",
        "features":features
    }
    DEST.parent.mkdir(parents=True,exist_ok=True)
    temp=DEST.with_suffix(".tmp")
    temp.write_text(json.dumps(payload,ensure_ascii=False,separators=(",",":")),
        encoding="utf-8")
    temp.replace(DEST)
    print("Emprises verts Paris Data:",len(features),"géométries ;",
          DEST.stat().st_size,"octets")


if __name__=="__main__":
    main()
