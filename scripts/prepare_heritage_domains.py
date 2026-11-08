#!/usr/bin/env python3
"""Contours documentés des grands domaines, sans rectangle ou pelouse inventés.

Les points des notices POP sont gérés séparément par prepare_monument_atlas.py.
Cette extraction récupère les contours OSM relevés (ODbL). Les faits proviennent
du Sénat / du Louvre / du ministère, indépendamment de la géométrie OSM.
L'échec d'un téléchargement n'autorise pas à inventer un polygone.
"""
from __future__ import annotations
import json,math,urllib.request,xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import quote
LON,LAT=2.3537,48.8545
MX=111320*math.cos(math.radians(LAT))
MZ=111132
DEST=Path(__file__).resolve().parents[1]/"public/data/metropole/places/heritage-areas.json"
SITES=[
 {"id":"luxembourg","osm":128206209,"name":"Jardin du Luxembourg","kind":"garden",
  "description":"Grand jardin du domaine du Sénat, composé de jardins à la française et à l'anglaise.",
  "facts":["Domaine de 25,72 hectares selon le Sénat, dont 21,75 hectares ouverts au public.",
           "Environ 3 000 arbres d'essences diverses, verger historique, massifs fleuris et fontaine Médicis.",
           "102 statues et monuments inventoriés par le Sénat."],
  "sourceUrl":"https://jardin.senat.fr/infos-pratiques/le-jardin-en-chiffres.html"},
 {"id":"tuileries","osm":53820452,"name":"Jardin des Tuileries — domaine du Louvre","kind":"garden",
  "description":"Jardin historique géré par l'établissement public du musée du Louvre et intégré au domaine national du Louvre et des Tuileries.",
  "facts":["Gestion du jardin des Tuileries confiée au Louvre depuis 2005.",
           "Six bassins avec fontaines ; alignements d'arbres, pelouses, massifs, allées et espaces minéraux.",
           "Le domaine du Louvre et des Tuileries est reconnu comme domaine national."],
  "sourceUrl":"https://www.louvre.fr/decouvrir/les-jardins"}
]
def get(url):
 req=urllib.request.Request(url,headers={"User-Agent":"PARIS-le-jeu/0.26 (source OpenStreetMap; patrimoine public)"})
 with urllib.request.urlopen(req,timeout=30) as response:
  return response.read()
def projected(lon,lat):return [round((lon-LON)*MX,2),round((lat-LAT)*MZ,2)]
def way(site):
 raw=get("https://api.openstreetmap.org/api/0.6/way/%s/full"%site["osm"])
 root=ET.fromstring(raw)
 nodes={n.attrib["id"]:(float(n.attrib["lon"]),float(n.attrib["lat"]))
        for n in root.findall("node") if "lon" in n.attrib}
 obj=next((w for w in root.findall("way") if w.attrib.get("id")==str(site["osm"])),None)
 if obj is None:raise ValueError("Contour OSM absent")
 coords=[nodes[n.attrib["ref"]] for n in obj.findall("nd")]
 if len(coords)<4 or coords[0]!=coords[-1]:raise ValueError("Contour OSM non fermé")
 if not all(2.15<lon<2.5 and 48.75<lat<48.96 for lon,lat in coords):
  raise ValueError("Emprise hors Paris")
 result={k:v for k,v in site.items() if k!="osm"}
 result["polygons"]=[[list(map(lambda p:projected(*p),coords))]]
 result["geometryUrl"]="https://www.openstreetmap.org/way/"+str(site["osm"])
 result["provenance"]="Contour vectoriel OpenStreetMap ODbL, non tracé cadastral officiel."
 return result
def tourism():
 """Inventaire supplémentaire des polygones touristiques OSM fermés.
 Limite stricte du nombre d'objets, aucune géométrie sans polygone réel.
 Une dénomination OSM n'est pas une protection Monuments historiques.
 """
 from urllib.parse import urlencode
 query="""[out:json][timeout:55];
 (
  way["tourism"~"^(attraction|museum|gallery)$"]["name"](48.75,2.15,48.97,2.58);
  way["building"]["name"~"Louvre",i](48.858,2.329,48.864,2.344);
  way["historic"~"^(monument|castle|memorial|fort|archaeological_site)$"]["name"](48.75,2.15,48.97,2.58);
  way["leisure"~"^(park|garden)$"]["name"](48.75,2.15,48.97,2.58);
 );out geom;"""
 elements=[]
 for endpoint in ("https://overpass-api.de/api/interpreter",
                  "https://overpass.kumi.systems/api/interpreter"):
  try:
   req=urllib.request.Request(endpoint,data=urlencode({"data":query}).encode(),
     headers={"User-Agent":"PARIS-le-jeu/0.26 patrimoine sourcé",
              "Content-Type":"application/x-www-form-urlencoded"})
   with urllib.request.urlopen(req,timeout=65) as response:
    dataset=json.load(response)
   if isinstance(dataset.get("elements"),list):
    elements=dataset["elements"]
    break
  except Exception as exc:
   print("Serveur OSM tourisme temporairement indisponible :",str(exc)[:160],flush=True)
 if not elements:
  print("Inventaire touristique supplémentaire absent, notices POP conservées",flush=True)
  return []
 result=[]
 seen=set()
 for entry in elements:
  tags=entry.get("tags") or {}
  name=str(tags.get("name") or "").strip()
  geom=entry.get("geometry") or []
  if not name or len(name)>160 or len(geom)<4 or len(geom)>600:continue
  points=[(p["lon"],p["lat"]) for p in geom if "lon" in p and "lat" in p]
  if len(points)!=len(geom) or points[0]!=points[-1]:continue
  if not all(2.12<lon<2.62 and 48.72<lat<49 for lon,lat in points):continue
  osm_id=entry.get("id")
  if not isinstance(osm_id,int) or osm_id in seen:continue
  seen.add(osm_id)
  ring=[projected(lon,lat) for lon,lat in points]
  minx=min(p[0] for p in ring);maxx=max(p[0] for p in ring)
  minz=min(p[1] for p in ring);maxz=max(p[1] for p in ring)
  if (maxx-minx)*(maxz-minz)<30:continue
  if tags.get("leisure") in ("park","garden"):
   kind="garden"
  else:kind="monument"
  page="https://www.openstreetmap.org/way/"+str(osm_id)
  feature={
   "id":"osm-"+str(osm_id),"name":name,"kind":kind,
   "description":"Objet ou ensemble touristique désigné dans OpenStreetMap. "
                 "La dénomination ne constitue pas une attestation de protection patrimoniale.",
   "facts":["Catégorie cartographiée : "+str(
    tags.get("tourism") or tags.get("historic") or tags.get("leisure") or "non précisée")],
   "sourceUrl":page,"geometryUrl":page,
   "provenance":"Géométrie vectorielle OSM (ODbL) ; limites non nécessairement cadastrales.",
   "polygons":[[ring]]}
  result.append(feature)
  if len(result)>=2200:break
 print("Objets touristiques OSM vectorisés :",len(result),flush=True)
 return result

def main():
 areas=[]
 for site in SITES:
  try:
   areas.append(way(site))
   print("Domaine vectoriel vérifié",site["id"],flush=True)
  except Exception as e:
   print("Contour absent, pas de polygone fictif :",site["id"],str(e),flush=True)
 # Ajouter le recensement cartographique plus large sans écraser les domaines officiels.
 areas.extend(tourism())
 # Ne pas écraser une extraction précédente valide par un fichier vide.
 if not areas and DEST.exists():
  print("Conservation des contours précédents",flush=True)
  return
 DEST.parent.mkdir(parents=True,exist_ok=True)
 DEST.write_text(json.dumps({"schema":1,
  "note":"Ces contours de domaines ne remplacent ni les surfaces végétales ni les bâtiments IGN.",
  "sources":"Sénat, musée du Louvre, OpenStreetMap contributors (ODbL)",
  "areas":areas},ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf8")
 print("Domaines géométriques sourcés :",len(areas),flush=True)
if __name__=="__main__":main()
