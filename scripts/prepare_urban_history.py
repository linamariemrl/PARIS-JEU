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
 """Lire l'API Explore 2.1 en pages de 100 résultats.
 L'export GeoJSON global (plus de 80 Mo) était rejeté, ce qui privait
 le jeu du répertoire historique des rues, malgré un build vert.
 """
 from urllib.parse import urlencode
 selected={
  "denominations-emprises-voies-actuelles":
   "id,typo_min,typvoie,prevoie,nomvoie,orig,historique,ouverture,geo_shape",
  "quartier_paris":"l_qu,c_ar,geom",
 }[dataset]
 offset=0
 total=None
 while total is None or offset<total:
  query=urlencode({"limit":100,"offset":offset,"select":selected,"lang":"fr"})
  url=BASE+dataset+"/records?"+query
  error=None
  page=None
  for attempt in range(3):
   try:
    request=urllib.request.Request(url,headers={
     "User-Agent":"PARIS-le-jeu/0.26 - urban history paginated documentary data",
     "Accept":"application/json"})
    with urllib.request.urlopen(request,timeout=45) as response:
     raw=response.read(6*1024*1024+1)
    if len(raw)>6*1024*1024:raise ValueError("Page de données trop volumineuse")
    page=json.loads(raw)
    if not isinstance(page.get("results"),list):
     raise ValueError("Résultats API absents")
    break
   except Exception as exc:
    error=exc
    if attempt<2:time.sleep(attempt+1)
  if page is None:
   raise RuntimeError(f"API paginée {dataset} offset={offset}: {error}")
  if total is None:
   total=page.get("total_count")
   if not isinstance(total,int) or total<1 or total>10000:
    raise RuntimeError(f"Pagination non couverte : {total} lignes")
  items=page["results"]
  if not items and offset<total:
   raise RuntimeError(f"Page vide prématurée {dataset}: {offset}/{total}")
  if offset==0 and items:
   example=items[0]
   raw_geom=example.get("geo_shape") or example.get("geom")
   print("API Paris diagnostic",dataset,
    "champs=",sorted(example.keys())[:24],
    "géométrie=",type(raw_geom).__name__,
    "aperçu=",str(raw_geom)[:170],flush=True)
  for properties in items:
   geo=properties.get("geo_shape") or properties.get("geom")
   if isinstance(geo,str):
    try:geo=json.loads(geo)
    except ValueError:geo=None
   if isinstance(geo,dict) and geo.get("type")=="Feature":
    geo=geo.get("geometry")
   yield {"properties":properties,"geometry":geo}
  offset+=len(items)
  if offset%1000<100 or offset>=total:
   print("Répertoire",dataset,":",offset,"/",total,flush=True)
def field(p,*names):
 for name in names:
  v=p.get(name)
  if isinstance(v,str) and v.strip():return v.strip()
 return ""
def fixed(v,max_chars=480):
 return " ".join(v.split())[:max_chars] if isinstance(v,str) else ""
def polygon_geometry(feature):
 geometry=feature.get("geometry") or feature.get("properties",{}).get("geo_shape") or feature.get("properties",{}).get("geom")
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
   part=part.simplify(.000006,preserve_topology=True)
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
 return field(p,"typo_min","typo","denom_com","l_voie","libelle","nom_complet",
              "denom_complete","denomination_complete","nom")
def prepare_quarters():
 """Toujours publier les 80 géométries avant l'index volumineux des rues.
 La sélection reste disponible même quand le serveur des rues est lent.
 """
 quarters=[]
 for f in download(SOURCES["quarters"]):
  p=f.get("properties") or {}
  name=fixed(field(p,"l_qu","l_quartier","nom_quartier","nom","libelle"),120)
  polys=polygon_geometry(f)
  try:arr=int(p.get("c_ar"))
  except (TypeError,ValueError):arr=None
  if name and polys and arr is not None and 1<=arr<=20:
   quarters.append({"name":name,"arr":arr,"polygons":polys})
 if len(quarters)!=80 or len({(q["arr"],q["name"]) for q in quarters})!=80:
  raise RuntimeError("Limites officielles incomplètes : "+
                     str(len(quarters))+" quartiers valides sur 80")
 OUTPUT.parent.mkdir(parents=True,exist_ok=True)
 lightweight=OUTPUT.with_name("quarters.json")
 lightweight.write_text(json.dumps({"schema":1,"quarters":quarters,
  "source":"Ville de Paris — quartiers administratifs (ODbL)",
  "sourceUrl":"https://opendata.paris.fr/explore/dataset/quartier_paris/"},
   ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf8")
 print("Quartiers autonomes : 80 contours officiels, "+
       str(lightweight.stat().st_size)+" octets",flush=True)
 return quarters

def encode():
 # Le fichier léger est enregistré en premier, indépendamment des rues.
 quarters=prepare_quarters()
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
 if len(streets)<3500:
  raise RuntimeError("Index des voies incomplet : "+str(len(streets)))
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
