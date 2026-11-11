#!/usr/bin/env python3
"""Index géographique R09, reproductible depuis les données du dépôt."""
from __future__ import annotations
import json, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"public/data/metropole/places/monuments.json"
BOUNDARY=ROOT/"public/data/metropole/limits.geojson"
TARGET=ROOT/"public/data/metropole/places/monuments-paris-index.json"
LON,LAT=2.3537,48.8545
MX=111320*math.cos(math.radians(LAT))
MZ=111132

def ring(x,y,pts):
    inside=False
    for i in range(len(pts)):
        a,b=pts[i],pts[i-1]
        if ((a[1]>y)!=(b[1]>y)) and x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0]:
            inside=not inside
    return inside

def within(x,y,rings):
    return ring(x,y,rings[0]) and not any(ring(x,y,r) for r in rings[1:])

def compute():
    source=json.loads(SOURCE.read_text(encoding="utf8"))
    geo=json.loads(BOUNDARY.read_text(encoding="utf8"))
    arrs={int(f["properties"]["id"][-2:]):f["geometry"]["coordinates"]
        for f in geo["features"] if f["properties"].get("kind")=="arrondissement"}
    assert set(arrs)==set(range(1,21)), "Contours d'arrondissements incomplets"
    byarr={str(i):0 for i in range(1,21)}
    entries=[]
    seen=set()
    for n in source["records"]:
        ref=n["ref"]
        if ref in seen: raise ValueError("Référence en double : "+ref)
        seen.add(ref)
        x=LON+n["x"]/MX
        y=LAT+n["z"]/MZ
        matches=[a for a,rings in arrs.items() if within(x,y,rings)]
        if len(matches)>1: raise ValueError("Plusieurs arrondissements : "+ref)
        if not matches: continue
        a=matches[0]
        entries.append([ref,a,n["name"]])
        byarr[str(a)]+=1
    entries.sort(key=lambda row:(row[1],row[0]))
    if len(entries)<500: raise ValueError("Import parisien manifestement incomplet")
    return {
        "schema":1,
        "scope":"Points POP/Mérimée géolocalisés dans les polygones des vingt arrondissements, sans prétention à une exhaustivité patrimoniale",
        "source":"public/data/metropole/places/monuments.json",
        "boundaries":"public/data/metropole/limits.geojson",
        "sourceExtractedAt":source["extractedAt"],
        "sourceRecords":len(source["records"]),
        "includedCount":len(entries),
        "excludedCount":len(source["records"])-len(entries),
        "byArrondissement":byarr,
        "entries":entries,
    }

if __name__=="__main__":
    result=compute()
    TARGET.write_text(json.dumps(result,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf8")
    print("Paris :",result["includedCount"],"Hors 20 arrondissements :",result["excludedCount"])
