#!/usr/bin/env python3
"""Auditer réellement les sources d'architecture libres du 4e.
Aucune donnée de matériau n'est devinée. Rapport public reproductible.
"""
from __future__ import annotations
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
import json
from prepare_4e import IGN_WFS, request_json

DEST=Path(__file__).resolve().parents[1]/"public/data/4e/architecture-audit.json"
FIELDS=("materiaux_des_murs","materiaux_de_la_toiture","hauteur",
 "altitude_minimale_sol","altitude_maximale_toit",
 "nombre_d_etages","nature","usage_1","date_creation")
PARIS_VOLUMES="https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/volumesbatisparis/records"
def ignore_empty(v):
    return v is None or str(v).strip().lower() in ("","none","null","nr","non renseigné","nan")
def query_ign():
    bbox="2.336,48.844,2.370,48.865,CRS:84"
    samples=[]
    for offset in (0,400,800):
        params={"SERVICE":"WFS","VERSION":"2.0.0","REQUEST":"GetFeature",
          "TYPENAMES":"BDTOPO_V3:batiment","SRSNAME":"CRS:84",
          "BBOX":bbox,"STARTINDEX":offset,"COUNT":400,
          "OUTPUTFORMAT":"application/json"}
        data=request_json(IGN_WFS+"?"+urlencode(params))
        rows=data.get("features")
        if not isinstance(rows,list):
            raise RuntimeError("IGN ne répond pas avec des features")
        samples.extend(rows)
        if len(rows)<400: break
    if len(samples)<100:
        raise RuntimeError("Pas assez de bâtiments pour l'audit")
    props=[f.get("properties") or {} for f in samples]
    counts={}
    for field in FIELDS:
        values=[p.get(field) for p in props if not ignore_empty(p.get(field))]
        counts[field]={"present":len(values),
          "codes":dict(Counter(str(v) for v in values).most_common(16)) if field.startswith("materiaux") else {}}
    geometry=Counter((f.get("geometry") or {}).get("type","null") for f in samples)
    with_z=0
    for f in samples:
        coords=(f.get("geometry") or {}).get("coordinates")
        while isinstance(coords,list) and coords and isinstance(coords[0],list):
            coords=coords[0]
        if isinstance(coords,list) and len(coords)>=3 and isinstance(coords[2],(int,float)):
            with_z+=1
    return {"sampleSize":len(samples),"fields":sorted(set().union(*(p.keys() for p in props))),
       "coverage":counts,"geometryTypes":dict(geometry),"coordinates3D":with_z}
def query_paris():
    data=request_json(PARIS_VOLUMES+"?"+urlencode({"limit":3}))
    rows=data.get("results")
    if not isinstance(rows,list): raise RuntimeError("Volumes bâtis invalide")
    return {"globalTotal":data.get("total_count"),
       "availableFields":sorted(rows[0].keys()) if rows else [],
       "geometryType":(rows[0].get("geom") or {}).get("type") if rows else None}
def main():
    ign=query_ign()
    paris=query_paris()
    output={"schema":1,"auditedAt":datetime.now(timezone.utc).isoformat(),
       "ignSource":"https://geoservices.ign.fr/bdtopo",
       "parisSource":"https://opendata.paris.fr/explore/dataset/volumesbatisparis/",
       "ign":ign,"parisVolumes":paris}
    DEST.parent.mkdir(parents=True,exist_ok=True)
    DEST.write_text(json.dumps(output,ensure_ascii=False,indent=2),encoding="utf-8")
    print("IGN architetural material coverage",ign["coverage"])
    print("IGN 3D coordinates",ign["coordinates3D"])
    print("Paris municipal volume fields",paris)
if __name__=="__main__":
    main()
