#!/usr/bin/env python3
"""Rechercher/normaliser à la publication les données publiques de Paris.

Sources : nomenclature officielle des voies (origine du nom, historique,
ouverture et géométrie) et quartiers administratifs (80 contours).
Pas de géométrie ou de date déduite d'une simple proximité.
Licence ODbL, Ville de Paris ; conserver les attributions dans le jeu.
"""
from __future__ import annotations
import json,math,urllib.request,time
from pathlib import Path
from shapely.geometry import shape
LON,LAT=2.3537,48.8545
MX=111320*math.cos(math.radians(LAT));MZ=111132
BASE="https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/"
ROOT=Path(__file__).resolve().parents[1]
OUTPUT=ROOT/"public/data/metropole/places/urban-places.json"
SOURCES={
 "streets":"denominations-emprises-voies-actuelles",
 "quarters":"quartier_paris"
}
def download(dataset):
 url=BASE+dataset+"/exports/geojson?lang=fr"
 error=None
 for attempt in range(2):
  try:
   request=urllib.request.Request(url,headers={
    "User-Agent":"PARIS-le-jeu/0.26 - urban history documentary export",
    "Accept":"application/geo+json,application/json"})
   with urllib.request.urlopen(request,timeout=42) as response:
    # Limite 24 Mio afin de ne pas épuiser la RAM du runner ou du téléphone.
    raw=response.read(80*1024*1024+1)
   if len(raw)>24*1024*1024:raise ValueError("Export geoJSON trop volumineux")
   doc=json.loads(raw)
   if doc.get("type")!="FeatureCollection" or not isinstance(doc.get("features"),list):
    raise ValueError("Export non GeoJSON")
   return doc["features"]
  except Exception as exc:
   error=exc
   print("Données parisiennes indisponibles",dataset,str(exc)[:130],flush=True)
   if attempt==0:time.sleep(1)
 raise RuntimeError(f"Source {dataset} absente: {error}")
def field(p,*names):
 for name in names:
  v=p.get(name)
  if isinstance(v,str) and v.strip():return v.strip()
 return ""
def fixed(v,max_chars=480):
 return " ".join(v.split())[:max_chars] if isinstance(v,str) else ""
def polygon_geometry(feature):
 geometry=feature.get("geometry") or feature.get("properties",{}).get("geo_shape")
 if not isinstance(geometry,dict):return []
 if geometry.get("type") not in ("Polygon","MultiPolygon"):return []
 try:
  geom=shape(geometry)
  if not geom.is_valid:geom=geom.buffer(0)
  if geom.is_empty:return []
  if geom.geom_type=="Polygon":polys=[geom]
  elif geom.geom_type=="MultiPolygon":polys=list(geom.geoms)
  else:return []
  output=[]
  for part in polys:
   if part.area<1e-11:continue
   # Tolérance métrique de ~50 cm (convertie de 1/111132°).
   part=part.simplify(.0000045,preserve_topology=True)
   rings=[]
   for ring in [part.exterior,*part.interiors]:
    pts=[[round((lon-LON)*MX,1),round((lat-LAT)*MZ,1)]
         for lon,lat in ring.coords]
    if len(pts)<4 or len(pts)>4000:continue
    if any(abs(x)>32000 or abs(z)>32000 for x,z in pts):continue
    rings.append(pts)
   if rings:output.append(rings)
   if len(output)>250:break
  return output
 except Exception as exc:
  print("Polygone exclu",str(exc)[:95],flush=True)
  return []
def names(p):
 # La plupart des versions de la nomenclature possèdent typvoie/prevoie/nomvoie.
 typ=field(p,"typvoie","type_voie","typevoie")
 article=field(p,"prevoie","preposition_voie")
 name=field(p,"nomvoie","nom_voie","nomvoie_libelle")
 full=" ".join(x for x in (typ,article,name) if x)
 if full:return full
 return field(p,"denom_com","l_voie","libelle","nom_complet",
              "denom_complete","denomination_complete","nom")
def encode():
 streets=[]
 for f in download(SOURCES["streets"]):
  p=f.get("properties") or {}
  name=fixed(names(p),145)
  poly=polygon_geometry(f)
  if not name or not poly:continue
  ident=str(p.get("id") or p.get("identifiant") or
    p.get("cdv") or p.get("code_voie") or len(streets))
  orig=fixed(field(p,"orig","origine_du_nom"),350)
  historique=fixed(field(p,"historique"),430)
  opened=fixed(field(p,"ouverture"),120)
  street_type=fixed(field(p,"typvoie","type_voie"),50)
  streets.append({"id":ident,"name":name,"type":street_type,
   "orig":orig,"history":historique,"opening":opened,"polygons":poly})
 quarters=[]
 for f in download(SOURCES["quarters"]):
  p=f.get("properties") or {}
  name=fixed(field(p,"l_qu","l_quartier","nom_quartier","nom","libelle"),120)
  polys=polygon_geometry(f)
  if name and polys:
   quarters.append({"name":name,"arr":p.get("c_ar"),"polygons":polys})
 if len(streets)<3500 or len(quarters)<75:
  raise RuntimeError("Index historique géographique incomplet : "+
   str(len(streets))+" voies ; "+str(len(quarters))+" quartiers")
 OUTPUT.parent.mkdir(parents=True,exist_ok=True)
 payload={"schema":1,"streets":streets,"quarters":quarters,
  "source":"Ville de Paris — nomenclature officielle des voies et quartiers administratifs (ODbL)",
  "sources":{k:"https://opendata.paris.fr/explore/dataset/"+v+"/"
    for k,v in SOURCES.items()}}
 OUTPUT.write_text(json.dumps(payload,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf8")
 print("Paris : "+str(len(streets))+" voies officielles et "+
  str(len(quarters))+" quartiers indexés, "+str(OUTPUT.stat().st_size)+
  " octets ; descriptions historiques uniquement si renseignées.",flush=True)
if __name__=="__main__":
 try:encode()
 except Exception as e:
  # Refuser une fausse couverture ; conserver les données précédentes
  # si la source réseau est interrompue lors d'une nouvelle publication.
  print("Index historique non mis à jour :",e,flush=True)
  if not OUTPUT.exists():print("La carte utilisera les replis contrôlés du jeu.",flush=True)
