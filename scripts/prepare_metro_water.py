#!/usr/bin/env python3
"""Hydrographie surfacique BD TOPO IGN de Paris et communes limitrophes.

Les eaux proviennent des polygones officiels; aucune rivière ni bassin
dessinés par interpolation. L'altitude de surface est conventionnelle.
"""
from __future__ import annotations
import json
import math
import time
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import urlopen, Request
from shapely.geometry import shape
from shapely.ops import unary_union, transform

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/"public/data/metropole"
DEST=BASE/"surfaces/water.json"
WFS="https://data.geopf.fr/wfs/ows"
LON,LAT=2.3537,48.8545
MX=111320*math.cos(math.radians(LAT))
MZ=111132


def request(url):
    last=None
    for retry in range(5):
        try:
            req=Request(url,headers={"Accept":"application/json",
                "User-Agent":"PARIS-SKYLINES-open-IGN/0.18"})
            with urlopen(req,timeout=100) as r:
                result=json.load(r)
            if result.get("type")!="FeatureCollection" or not isinstance(
                result.get("features"),list):
                raise ValueError("Réponse IGN non FeatureCollection")
            return result
        except Exception as error:
            last=error
            if retry<4:time.sleep(2*(retry+1))
    raise RuntimeError("IGN WFS indisponible : "+str(last))


def wfs(bbox):
    ids=set()
    for page in range(50):
        query={
            "SERVICE":"WFS","VERSION":"2.0.0","REQUEST":"GetFeature",
            "TYPENAMES":"BDTOPO_V3:surface_hydrographique",
            "SRSNAME":"CRS:84",
            "BBOX":",".join(f"{v:.8f}" for v in bbox)+",CRS:84",
            "COUNT":350,"STARTINDEX":page*350,
            "OUTPUTFORMAT":"application/json"
        }
        data=request(WFS+"?"+urlencode(query))
        for item in data["features"]:
            ident=str(item.get("id") or
                (item.get("properties") or {}).get("cleabs") or "")
            if ident in ids:
                raise RuntimeError("Pagination IGN répétée : "+ident)
            ids.add(ident)
            yield ident,item
        if len(data["features"])<350:return
        time.sleep(.06)
    raise RuntimeError("Nombre de pages hydrographie dépassé")


def local(x,y,z=None):
    return (x-LON)*MX,(y-LAT)*MZ


def polygons(geom):
    if geom.is_empty:return []
    if geom.geom_type=="Polygon":return [geom]
    return [poly for part in getattr(geom,"geoms",[])
        for poly in polygons(part)]


def main():
    limits=json.loads((BASE/"limits.geojson").read_text(encoding="utf-8"))
    places=[shape(f["geometry"]) for f in limits["features"] if
        f["properties"]["kind"] in ("paris","commune_limitrophe")]
    if len(places)<28:raise ValueError("Périmètre métropolitain incomplet")
    area=unary_union(places)
    west,south,east,north=area.bounds
    nx,ny=4,3
    seen=set()
    features=[]
    for ix in range(nx):
        for iy in range(ny):
            bounds=(
                west+(east-west)*ix/nx,
                south+(north-south)*iy/ny,
                west+(east-west)*(ix+1)/nx,
                south+(north-south)*(iy+1)/ny
            )
            count=0
            for ident,feature in wfs(bounds):
                if not ident or ident in seen:continue
                seen.add(ident)
                raw=feature.get("geometry")
                if not raw or raw.get("type") not in ("Polygon","MultiPolygon"):
                    continue
                geom=shape(raw)
                if geom.is_empty:continue
                if not geom.is_valid:geom=geom.buffer(0)
                if not geom.intersects(area):continue
                clipped=geom.intersection(area)
                projected=transform(local,clipped).simplify(.55,preserve_topology=True)
                pieces=[]
                for poly in polygons(projected):
                    if poly.area<12:continue
                    rings=[]
                    for ring in [poly.exterior,*poly.interiors]:
                        coords=[[round(x,2),round(z,2)] for x,z in ring.coords]
                        if len(coords)>=4:rings.append(coords)
                    if rings:pieces.append(rings)
                if pieces:
                    features.append({"kind":"water","polygons":pieces})
                    count+=1
            print("Sous-zone",ix,iy,":",count,"entités nouvelles",flush=True)
    if len(features)<12:
        raise ValueError("IGN : extraction hydrographique trop faible")
    payload={
       "schema":1,"source":"IGN BD TOPO V3, surfaces hydrographiques",
       "sourceUrl":"https://geoservices.ign.fr/bdtopo",
       "license":"Licence Ouverte 2.0",
       "extractedAt":datetime.now(timezone.utc).isoformat(),
       "count":len(features),
       "note":"Formes d'eau officielles ; altitude de la nappe de rendu conventionnelle.",
       "features":features
    }
    DEST.parent.mkdir(parents=True,exist_ok=True)
    tmp=DEST.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload,ensure_ascii=False,separators=(",",":")),
        encoding="utf-8")
    tmp.replace(DEST)
    print("Hydrographie IGN publiée :",len(features),DEST.stat().st_size,"octets")


if __name__=="__main__":
    main()
