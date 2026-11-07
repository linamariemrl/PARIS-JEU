#!/usr/bin/env python3
"""Évaluer les vraies formes de bâti détaillées (Ville de Paris et OSM).
Aucune extraction ni distribution de contenu Google.
"""
from __future__ import annotations
import json,time
from urllib.parse import urlencode
from urllib.request import Request,urlopen
from pathlib import Path

API="https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/volumesbatisparis/records"
OUT=Path(__file__).resolve().parents[1]/"public/data/4e/volumes-audit.json"

def get(url,timeout=70):
    req=Request(url,headers={"Accept":"application/json",
      "User-Agent":"PARIS-game-audit/0.6 (GitHub Actions, open-data)"})
    with urlopen(req,timeout=timeout) as stream:return json.load(stream)

def main():
    results={}
    # Numeric arrondissement identifier observed in the official schema.
    for where in ["n_ar=4","n_sq_ar=4"]:
        url=API+"?"+urlencode({"where":where,"limit":3})
        try:
            sample=get(url)
            rows=sample.get("results",[])
            results[where]={
              "total":sample.get("total_count"),"fields":sorted(rows[0]) if rows else [],
              "samples":[{k:v for k,v in item.items() if k!="geom"}
                for item in rows[:2]],
              "geometryType":(
                (rows[0].get("geom") or {}).get("geometry") or
                (rows[0].get("geom") or {})
              ).get("type") if rows else None
            }
        except Exception as exc:
            results[where]={"error":str(exc)}
    # Small query only for buildings where the roof shape is already explicitly known.
    query='[out:json][timeout:90];way["building"]["roof:shape"](48.848,2.338,48.861,2.374);out tags center;'
    urls=["https://overpass-api.de/api/interpreter",
          "https://overpass.kumi.systems/api/interpreter"]
    for endpoint in urls:
        try:
            request=Request(endpoint,data=urlencode({"data":query}).encode("utf-8"),
                 headers={"User-Agent":"PARIS-game-audit/0.6","Accept":"application/json"})
            with urlopen(request,timeout=110) as res:data=json.load(res)
            rows=data.get("elements",[])
            results["osm_roofs"]={"count":len(rows),"shapes":{
              shape:sum(1 for item in rows if item.get("tags",{}).get("roof:shape")==shape)
              for shape in set(item.get("tags",{}).get("roof:shape","") for item in rows)
            },"examples":[{"roof:shape":item.get("tags",{}).get("roof:shape"),
                 "roof:height":item.get("tags",{}).get("roof:height")} for item in rows[:5]],
                 "source":"© OpenStreetMap contributors, ODbL 1.0"}
            break
        except Exception as exc:
            results["osm_roofs"]={"error":str(exc),"lastEndpoint":endpoint}
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(results,ensure_ascii=False,indent=2),encoding="utf-8")
    print(json.dumps(results,ensure_ascii=False,indent=2)[:8000])
if __name__=="__main__":
    main()
