#!/usr/bin/env python3
"""Décors de jardins patrimoniaux depuis les géométries OSM existantes.

Sources institutionnelles des notices (Sénat, Louvre) indépendantes de ces
levés OSM ODbL. Clip sur les emprises reconnues : aucune allée, plantation,
pelouse ou eau inventée. Les lignes de chemin ne prétendent pas mesurer
la largeur ni la nature du revêtement.
"""
from __future__ import annotations
import json,math,urllib.request
from pathlib import Path
from urllib.parse import urlencode
from shapely.geometry import Polygon,LineString,Point
ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"public/data/metropole/places/heritage-areas.json"
DEST=ROOT/"public/data/metropole/places/garden-details.json"
LON,LAT=2.3537,48.8545
MX=111320*math.cos(math.radians(LAT));MZ=111132
def local(lon,lat):return [round((lon-LON)*MX,2),round((lat-LAT)*MZ,2)]
def garden_shapes():
 if not SOURCE.exists():return []
 obj=json.loads(SOURCE.read_text(encoding="utf8"))
 results=[]
 for d in obj.get("areas",[]):
  if d.get("id") not in ("luxembourg","tuileries"):continue
  for poly in d.get("polygons",[]):
   if poly:
    area=Polygon(poly[0],poly[1:])
    if area.is_valid and area.area>10000:results.append(area)
 return results
def overpass():
 query="""[out:json][timeout:50];
 (
  way["landuse"~"^(grass|flowerbed|orchard|forest)$"](48.842,2.317,48.869,2.353);
  way["natural"~"^(water|wood)$"](48.842,2.317,48.869,2.353);
  way["highway"~"^(footway|path|pedestrian)$"](48.842,2.317,48.869,2.353);
  node["natural"="tree"](48.842,2.317,48.869,2.353);
 );out geom;"""
 payload=urlencode({"data":query}).encode()
 for server in ("https://overpass.kumi.systems/api/interpreter",
                "https://overpass-api.de/api/interpreter"):
  try:
   req=urllib.request.Request(server,payload,headers={
    "User-Agent":"PARIS-le-jeu/0.26 jardins documentés",
    "Content-Type":"application/x-www-form-urlencoded"})
   with urllib.request.urlopen(req,timeout=70) as response:
    result=json.load(response)
   if isinstance(result.get("elements"),list):return result["elements"]
  except Exception as exc:
   print("Source OSM jardins momentanément indisponible",str(exc)[:160],flush=True)
 return []
def polygons(shape):
 if shape.is_empty:return []
 if shape.geom_type=="Polygon":items=[shape]
 elif shape.geom_type=="MultiPolygon":items=list(shape.geoms)
 else:return []
 result=[]
 for item in items:
  if item.area<3:continue
  r=[[[round(x,2),round(y,2)] for x,y in item.exterior.coords]]
  for hole in item.interiors:
   r.append([[round(x,2),round(y,2)] for x,y in hole.coords])
  if sum(len(v) for v in r)<900:result.append(r)
 return result
def lines(shape):
 if shape.is_empty:return []
 if shape.geom_type=="LineString":items=[shape]
 elif shape.geom_type=="MultiLineString":items=list(shape.geoms)
 else:return []
 return [[[round(x,2),round(y,2)] for x,y in l.coords]
         for l in items if l.length>2 and len(l.coords)<900]
def main():
 domains=garden_shapes()
 if not domains:
  print("Périmètres touristiques non disponibles, pas de décors fictifs",flush=True)
  return
 from shapely.ops import unary_union
 scope=unary_union(domains)
 features=[];path_lines=[];trees=[];seen=set()
 for entry in overpass():
  ident=(entry.get("type"),entry.get("id"))
  if ident in seen:continue
  seen.add(ident)
  tags=entry.get("tags") or {}
  if entry.get("type")=="node" and tags.get("natural")=="tree":
   if "lat" not in entry or "lon" not in entry:continue
   x,z=local(entry["lon"],entry["lat"])
   if not scope.covers(Point(x,z)):continue
   h=tags.get("height")
   try:height=float(str(h).replace("m","").strip())
   except (ValueError,TypeError):height=0
   trees.append([x,z,round(height,1) if 2<=height<=40 else 0])
   continue
  if entry.get("type")!="way":continue
  geometry=entry.get("geometry") or []
  if len(geometry)<2 or len(geometry)>1500:continue
  try:pts=[local(p["lon"],p["lat"]) for p in geometry]
  except KeyError:continue
  typ=None
  if tags.get("landuse") in ("grass","orchard","forest","flowerbed"):
   typ={"grass":"grass","orchard":"wood","forest":"wood",
        "flowerbed":"flower"}[tags["landuse"]]
  elif tags.get("natural") in ("wood","water"):
   typ={"wood":"wood","water":"water"}[tags["natural"]]
  if typ and len(pts)>3 and pts[0]==pts[-1]:
   p=Polygon(pts)
   if not p.is_valid:p=p.buffer(0)
   if p.is_empty:continue
   for r in polygons(p.intersection(scope)):
    features.append([typ,r])
  if tags.get("highway") in ("footway","path","pedestrian"):
   line=LineString(pts)
   path_lines.extend(lines(line.intersection(scope)))
 if not features and not path_lines and not trees:
  print("Aucun détail réel reçu ; aucune géométrie générée",flush=True)
  return
 DEST.parent.mkdir(parents=True,exist_ok=True)
 doc={"schema":1,"source":"OpenStreetMap contributors (ODbL)",
      "note":"Détails facultatifs mesurés, non exhaustifs. Arbres sans hauteur: symboles schématiques.",
      "features":features,"paths":path_lines,"trees":trees}
 DEST.write_text(json.dumps(doc,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf8")
 print("Jardins patrimoniaux :",len(features),"surfaces,",
       len(path_lines),"traces d'allées,",len(trees),"arbres renseignés",flush=True)
if __name__=="__main__":main()
