#!/usr/bin/env python3
"""Périmètre administratif exact de PARIS, produit depuis les sources officielles.

Pas de liste écrite de mémoire. La liste des communes limitrophes est
entièrement calculée sur les frontières IGN ADMIN EXPRESS en EPSG:2154.
Les arrondissements sont téléchargés depuis Paris Data (20 limites).
"""
from __future__ import annotations
import json,time,math
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request,urlopen
from shapely.geometry import shape,mapping
from shapely.ops import transform,unary_union
from pyproj import Transformer

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"public/data/metropole"
API="https://data.geopf.fr/wfs/ows"
PARIS_API="https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/arrondissements/records"
TO_2154=Transformer.from_crs("EPSG:4326","EPSG:2154",always_xy=True).transform
TO_4326=Transformer.from_crs("EPSG:2154","EPSG:4326",always_xy=True).transform
BBOX=(2.12,48.72,2.62,49.05)

def request_json(url:str)->dict:
    last=None
    for retry in range(4):
        try:
            req=Request(url,headers={"Accept":"application/json",
                 "User-Agent":"PARIS-game-public-GitHub-Actions/geography"})
            with urlopen(req,timeout=75) as response:
                data=json.load(response)
            if not isinstance(data,dict):raise ValueError("JSON incomplet")
            return data
        except Exception as e:
            last=e
            if retry<3:time.sleep(2**retry)
    raise RuntimeError("Echec de source officielle: "+str(last))

def query_ign_communes():
    for layer in ("ADMINEXPRESS-COG.LATEST:commune",
                   "LIMITES_ADMINISTRATIVES_EXPRESS.LATEST:commune"):
        params={"SERVICE":"WFS","VERSION":"2.0.0","REQUEST":"GetFeature",
          "TYPENAMES":layer,"SRSNAME":"CRS:84",
          "BBOX":",".join(map(str,BBOX))+",CRS:84",
          "COUNT":500,"OUTPUTFORMAT":"application/json"}
        try:
            data=request_json(API+"?"+urlencode(params))
            features=data.get("features",[])
            if data.get("type")=="FeatureCollection" and len(features)>=25:
                print("Source IGN:",layer,"entités:",len(features),flush=True)
                if len(features)>=500:
                    raise ValueError("Résultat WFS plafonné, source non exhaustive")
                return layer,features
        except Exception as e:
            print("Tentative IGN:",layer,str(e)[:180],flush=True)
    raise RuntimeError("Aucune extraction ADMIN EXPRESS exhaustive validée")

def code_of(properties):
    for key in ("code_insee","code_insee_commune","insee_com","insee","code"):
        value=str(properties.get(key) or "").strip()
        if len(value)==5 and value[:2].isdigit():return value
    return ""

def extract_communes(features):
    found={}
    for feat in features:
        props=feat.get("properties") or {}
        code=code_of(props)
        if not code or not feat.get("geometry"):continue
        geom=shape(feat["geometry"])
        if not geom.is_valid:geom=geom.buffer(0)
        if geom.is_empty:continue
        geom=transform(TO_2154,geom)
        name=str(props.get("nom") or props.get("nom_commune") or
                 props.get("nom_officiel") or code)
        if code in found:
            raise RuntimeError("Code administratif doublé: "+code)
        found[code]={"name":name,"geom":geom}
    if "75056" not in found:
        raise RuntimeError("La commune Paris (75056) n'a pas été trouvée dans IGN")
    return found

def download_arrondissements():
    data=request_json(PARIS_API+"?"+urlencode({"limit":100}))
    rows=data.get("results",[])
    result={}
    for row in rows:
        try:num=int(row.get("c_ar") or 0)
        except (ValueError,TypeError):continue
        if not 1<=num<=20 or not isinstance(row.get("geom"),dict):continue
        geom=shape(row["geom"])
        if not geom.is_valid:geom=geom.buffer(0)
        if geom.is_empty:continue
        if num in result:raise RuntimeError("Arrondissement doublé: "+str(num))
        result[num]=transform(TO_2154,geom)
    if set(result)!=set(range(1,21)):
        raise RuntimeError("Source Paris Data incomplète: "+str(sorted(result)))
    return result

def simplified(geom,tolerance=.7):
    output=transform(TO_4326,geom.simplify(tolerance,preserve_topology=True))
    return mapping(output)

def produce(communes,arrondissements,source):
    paris=communes["75056"]["geom"]
    # Les frontières doivent se superposer : source IDENTIQUE, pas de buffer
    # arbitraire de plusieurs centaines de mètres qui créerait de faux voisins.
    neighbors={}
    for code,record in communes.items():
        if code=="75056":continue
        line=paris.boundary.intersection(record["geom"].boundary)
        shared=line.length
        if shared>35:
            neighbors[code]={"name":record["name"],
              "sharedBoundaryMeters":round(shared,1),
              "geom":record["geom"]}
    if not 18<=len(neighbors)<=45:
        raise RuntimeError("Nombre de voisins incohérent: "+str(len(neighbors))+
            ", vérifier les couches IGN et les géométries")
    # Vérification du raccord Paris Data : les bois peuvent être hors des
    # limites des secteurs municipaux. Le différentiel est signalé.
    arr_union=unary_union(list(arrondissements.values()))
    uncovered=paris.difference(arr_union).area/1e6
    features=[]
    def record(kind,identifier,name,geom,**kwargs):
        features.append({"type":"Feature","properties":{
          "kind":kind,"id":identifier,"name":name,**kwargs},
          "geometry":simplified(geom)})
    record("paris","75056","Paris",paris)
    for num in sorted(arrondissements):
        record("arrondissement",f"751{num:02d}",f"{num}e arrondissement",
          arrondissements[num],number=num)
    for code,neighbor in sorted(neighbors.items()):
        record("commune_limitrophe",code,neighbor["name"],neighbor["geom"],
          sharedBoundaryMeters=neighbor["sharedBoundaryMeters"],manageable=False)
    actors=[{"id":code,"name":v["name"],"politicalColor":None,
       "population":None,"employment":None,"housing":None,
       "annualBudgetEUR":None,"manageable":False,"simulation":"autonomous-pending"}
      for code,v in sorted(neighbors.items())]
    date=datetime.now(timezone.utc).isoformat()
    status={"schema":1,"source":"IGN "+source+"; Ville de Paris arrondissements",
      "sourceURL":"https://data.geopf.fr/wfs/ows",
      "arrondissementSourceURL":"https://opendata.paris.fr/explore/dataset/arrondissements/",
      "generatedAt":date,"coordinateSystem":"EPSG:4326",
      "intersectionSystem":"EPSG:2154",
      "parisINSEE":"75056","arrondissementCount":len(arrondissements),
      "neighborCount":len(neighbors),
      "neighbors":[{"insee":k,"name":v["name"],
                     "sharedBoundaryMeters":v["sharedBoundaryMeters"]}
                   for k,v in sorted(neighbors.items())],
      "officialMunicipalAreaSqKm":round(paris.area/1e6,2),
      "areaParisNotCoveredByArrondissementPolygonsSqKm":round(uncovered,3),
      "renderingStatus":"administrative outlines only; buildings remain 4e until a validated building extraction",
      "note":"No economic or political values invented for neighboring municipalities"}
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/"limits.geojson").write_text(json.dumps({
      "type":"FeatureCollection","features":features
    },ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    (OUT/"neighbors.json").write_text(json.dumps({
      "schema":1,"generatedAt":date,"actors":actors
    },ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    (OUT/"perimeter.json").write_text(
      json.dumps(status,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Périmètre généré : 20 arrondissements,",
      len(neighbors),"communes limitrophes, Paris",round(paris.area/1e6,2),
      "km², écart arrondissements",round(uncovered,3),"km²",flush=True)

if __name__=="__main__":
    layer,features=query_ign_communes()
    produce(extract_communes(features),download_arrondissements(),layer)
