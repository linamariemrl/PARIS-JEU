#!/usr/bin/env python3
"""Interroger l'index officiel IGN LiDAR HD autour du 4e.

Rapport d'identification des dalles, sans produire de faux toits.
L'index WFS peut fournir des liens MNH à 50 cm, susceptibles d'être
lourds: les dalles ne sont jamais téléchargées sur Android.
"""
from __future__ import annotations
import json,time
from pathlib import Path
from datetime import datetime,timezone
from urllib.parse import urlencode
from urllib.request import Request,urlopen
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"data/quality/lidar-4e-availability.json"
URL="https://data.geopf.fr/wfs/ows"
LAYER="IGNF_LIDAR-HD_METADONNEE:metadata"
BBOX="2.327,48.838,2.372,48.869,CRS:84"

def fetch():
  params={
    "SERVICE":"WFS","VERSION":"2.0.0","REQUEST":"GetFeature",
    "TYPENAMES":LAYER,"SRSNAME":"CRS:84","BBOX":BBOX,
    "OUTPUTFORMAT":"application/json","COUNT":250
  }
  req=Request(URL+"?"+urlencode(params),headers={
    "User-Agent":"PARIS-le-jeu-GitHubActions/lidar-index",
    "Accept":"application/json"})
  with urlopen(req,timeout=120) as response:
    data=json.load(response)
  if data.get("type")!="FeatureCollection" or not isinstance(data.get("features"),list):
    raise RuntimeError("IGN n'a pas renvoyé de GeoJSON valide")
  return data["features"]

def main():
  features=fetch()
  if len(features)>=250:raise RuntimeError(
    "Index LiDAR limité à 250 entités, le périmètre serait tronqué")
  candidates=[]
  keys=set()
  for f in features:
    p=f.get("properties") or {}
    keys.update(p.keys())
    details=p.get("metadata")
    if isinstance(details,str):
      try:details=json.loads(details)
      except (ValueError,TypeError):details={}
    if not isinstance(details,dict):details={}
    url=p.get("url_mnh") or details.get("url_mnh") or p.get("url_MNH")
    if isinstance(url,list):url=next((v for v in url if isinstance(v,str)),None)
    if not isinstance(url,str) or not url.startswith("https://"):
      continue
    candidates.append({
      "id":str(p.get("id") or f.get("id") or len(candidates))[:150],
      "url":url,
      "geometry":f.get("geometry"),
      "date":str(p.get("date_edition") or p.get("date_fin_acquisition") or "")
    })
  report={
    "schema":1,
    "source":URL,
    "layer":LAYER,
    "bbox":BBOX,
    "retrievedAt":datetime.now(timezone.utc).isoformat(),
    "metadataCount":len(features),
    "tilesWithMNH":len(candidates),
    "available":bool(candidates),
    "fieldNames":sorted(keys),
    "tiles":candidates,
    "status":"LiDAR MNH indexed only; roofs have not been reconstructed",
    "licence":"Licence Ouverte 2.0"
  }
  OUT.parent.mkdir(parents=True,exist_ok=True)
  OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
  print("Index LiDAR: ",len(features),"features et",
        len(candidates),"liens MNH",flush=True)
  print("Champs IGN:",sorted(keys),flush=True)

if __name__=="__main__":main()
