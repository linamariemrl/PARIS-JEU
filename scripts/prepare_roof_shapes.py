#!/usr/bin/env python3
"""Associer les tags de formes de toit OSM aux bâtiments IGN par recouvrement.

Données ouvertes © OpenStreetMap contributors / ODbL.
Les formes non documentées ne sont jamais inventées. Les hauteurs de toit ne
sont acceptées que si explicitement décrites dans OSM.
"""
from __future__ import annotations
import json,math,re,time
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request,urlopen
from shapely.geometry import Polygon,MultiPolygon,shape
from shapely.strtree import STRtree

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/"public/data/4e"
OUT=BASE/"roof-shapes.json"
ENDS=["https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter"]
SHAPES={"flat","gabled","hipped","mansard","gambrel","half-hipped",
        "pyramidal","skillion"}
BBOX=(48.848,2.338,48.861,2.374)

def get_features():
    query=(
      "[out:json][timeout:120];"
      f'way["building"]["roof:shape"]({",".join(map(str,BBOX))});'
      "out tags geom;"
    )
    last=None
    for endpoint in ENDS:
        try:
            req=Request(endpoint,data=urlencode({"data":query}).encode("utf-8"),
              headers={"Accept":"application/json","User-Agent":"PARIS-game-roof-shapes/0.6"})
            with urlopen(req,timeout=145) as res:result=json.load(res)
            elements=result.get("elements")
            if not isinstance(elements,list) or len(elements)<50:
                raise RuntimeError("Réponse OSM incomplète")
            return elements
        except Exception as exc:
            last=exc
            time.sleep(2)
    raise RuntimeError("Services OSM indisponibles : "+str(last))

def osm_polygon(element):
    pts=[(p["lon"],p["lat"]) for p in element.get("geometry",[])
         if isinstance(p,dict) and "lon" in p and "lat" in p]
    if len(pts)<4 or pts[0]!=pts[-1]:return None
    geom=Polygon(pts)
    if not geom.is_valid:geom=geom.buffer(0)
    if geom.is_empty:return None
    return geom

def height(raw):
    if raw is None:return None
    value=str(raw).strip().replace(",",".")
    if not re.fullmatch(r"\d+(?:\.\d+)?\s*(?:m)?",value):return None
    result=float(value.rstrip("m").strip())
    return round(result,2) if 0.3<=result<=25 else None

def building_index():
    features=[]
    for path in sorted((BASE/"tiles").glob("*.json")):
        for b in json.loads(path.read_text(encoding="utf-8"))["buildings"]:
            polygons=[Polygon(part[0],part[1:]) for part in b["polygons"] if part]
            if not polygons:continue
            geo=polygons[0] if len(polygons)==1 else MultiPolygon(polygons)
            if not geo.is_valid:geo=geo.buffer(0)
            if geo.is_empty:continue
            features.append((b["id"],geo))
    return features

def join(osm,buildings):
    shapes=[p for _,p in buildings]
    tree=STRtree(shapes)
    assignments={}
    skipped={"unsupported":0,"no_geometry":0,"unmatched":0,"ambiguous":0}
    for item in osm:
        tags=item.get("tags",{})
        roof=str(tags.get("roof:shape","")).lower().strip().replace("_","-")
        if roof not in SHAPES:
            skipped["unsupported"]+=1;continue
        geom=osm_polygon(item)
        if geom is None:
            skipped["no_geometry"]+=1;continue
        best=None
        candidates=[]
        for index in tree.query(geom):
            ref=shapes[int(index)]
            intersect=geom.intersection(ref).area
            union=geom.union(ref).area
            iou=intersect/union if union>0 else 0
            if iou>=.63:candidates.append((iou,buildings[int(index)][0]))
        candidates.sort(reverse=True)
        if not candidates:
            skipped["unmatched"]+=1;continue
        if len(candidates)>1 and candidates[0][0]-candidates[1][0]<.12:
            skipped["ambiguous"]+=1;continue
        score,ident=candidates[0]
        if ident in assignments and assignments[ident]["score"]>=score:
            continue
        record={"shape":roof,"sourceId":int(item.get("id",0)),
                "score":round(score,3)}
        measured=height(tags.get("roof:height"))
        if measured is not None:record["height"]=measured
        direction=tags.get("roof:direction")
        try:
            if direction is not None and 0<=float(direction)<360:
                record["direction"]=round(float(direction),1)
        except (ValueError,TypeError):pass
        assignments[ident]=record
    return assignments,skipped

def main():
    osm=get_features()
    buildings=building_index()
    by_id,skipped=join(osm,buildings)
    if len(by_id)<12:
        raise RuntimeError(f"Moins de 12 formes fiables IGN/OSM : {len(by_id)} ; {skipped}")
    payload={"schema":1,"source":"© OpenStreetMap contributors",
       "license":"ODbL 1.0","sourceUrl":"https://www.openstreetmap.org/copyright",
       "matchMethod":"Intersection des emprises OSM et IGN, IoU >= 0.63, sans ambiguïté",
       "count":len(by_id),
       "heightKnown":sum("height" in record for record in by_id.values()),
       "byId":by_id}
    temp=OUT.with_suffix(".tmp")
    temp.write_text(json.dumps(payload,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    temp.replace(OUT)
    print(f"Toitures documentées : {len(by_id)} / {len(buildings)} ; "
          f"hauteur de toit mesurée : {payload['heightKnown']} ; exclues : {skipped}")
if __name__=="__main__":main()
