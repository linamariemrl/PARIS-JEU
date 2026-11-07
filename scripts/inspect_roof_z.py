#!/usr/bin/env python3
"""Mesurer les variations de Z des contours IGN, sans conclure à des pentes
si les géométries fournies ne les contiennent pas.
"""
from collections import Counter
from urllib.parse import urlencode
import json
from prepare_4e import request_json,IGN_WFS
url=IGN_WFS+"?"+urlencode({
  "SERVICE":"WFS","VERSION":"2.0.0","REQUEST":"GetFeature",
  "TYPENAMES":"BDTOPO_V3:batiment","SRSNAME":"CRS:84",
  "BBOX":"2.345,48.849,2.358,48.858,CRS:84",
  "COUNT":220,"OUTPUTFORMAT":"application/json"})
data=request_json(url)
features=data.get("features") or []
stats={"count":len(features),"varyingRoofContours":0,"flatContours":0,"unknown":0,"examples":[]}
for f in features:
    def allcoords(a):
        if isinstance(a,list):
            if len(a)>=3 and all(isinstance(v,(int,float)) for v in a[:3]):
                yield a
            else:
                for x in a:yield from allcoords(x)
    coords=list(allcoords((f.get("geometry") or {}).get("coordinates",[])))
    z=[x[2] for x in coords]
    if not z:
        stats["unknown"]+=1
        continue
    spread=max(z)-min(z)
    if spread>0.5:stats["varyingRoofContours"]+=1
    else:stats["flatContours"]+=1
    props=f.get("properties") or {}
    if len(stats["examples"])<14 and (spread>0.5 or len(stats["examples"])<5):
        stats["examples"].append({
          "id":props.get("cleabs"),
          "vertices":len(coords),"zmin":min(z),"zmax":max(z),
          "firstPoints":coords[:4],
          "alt_sol":props.get("altitude_minimale_sol"),
          "alt_toit":props.get("altitude_minimale_toit"),
          "height":props.get("hauteur")})
print(json.dumps(stats,ensure_ascii=False,indent=2))
