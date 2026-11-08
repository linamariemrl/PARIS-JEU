#!/usr/bin/env python3
"""Inventaire de notices de monuments, pas d'attribution abusive aux volumes.

POP/Mérimée ministère de la Culture, département de Paris.
Une notice géopositionnée ne garantit pas que tout bâtiment proche relève
du même monument : l'interface doit montrer la distance et la source.
"""
from __future__ import annotations
import json,math,time,re
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request,urlopen

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/"public/data/metropole/places/monuments.json"
API=("https://data.culturecommunication.gouv.fr/api/explore/v2.1/catalog/"
     "datasets/liste-des-immeubles-proteges-au-titre-des-monuments-historiques/records")
LON,LAT=2.3537,48.8545
MX=111320*math.cos(math.radians(LAT));MZ=111132

def api(params):
    url=API+"?"+urlencode(params)
    last=None
    for attempt in range(5):
        try:
            req=Request(url,headers={"Accept":"application/json",
                                     "User-Agent":"PARIS-SKYLINES-Culture-data/0.19"})
            with urlopen(req,timeout=100) as f:
                data=json.load(f)
            if not isinstance(data.get("results"),list):
                raise ValueError("Réponse culture non conforme")
            return data
        except Exception as exc:
            last=exc
            if attempt<4:time.sleep(2+attempt*2)
    raise RuntimeError("Ministère de la Culture indisponible : "+str(last))

def records():
    for condition in (
        "departement_format_numerique = '75'",
        "departement_format_numerique = 75",
    ):
        try:
            first=api({"where":condition,"limit":100,"offset":0})
            if 100<=first.get("total_count",0)<=10000:break
        except RuntimeError:
            continue
    else:
        raise ValueError("Notices MH de Paris non filtrables par département")
    total=first["total_count"]
    yield from first["results"]
    for offset in range(100,total,100):
        result=api({"where":condition,"limit":100,"offset":offset})
        yield from result["results"]
        time.sleep(.15)

def coordinates(value):
    if isinstance(value,dict):
        if "lat" in value and "lon" in value:
            return float(value["lon"]),float(value["lat"])
        if value.get("type")=="Point" and isinstance(value.get("coordinates"),list):
            return float(value["coordinates"][0]),float(value["coordinates"][1])
    if isinstance(value,(list,tuple)) and len(value)>=2:
        a,b=map(float,value[:2])
        if 47<a<50 and 1<b<4:return b,a
        if 1<a<4 and 47<b<50:return a,b
    if isinstance(value,str):
        numbers=re.findall(r"[-+]?\d+\.\d+",value)
        if len(numbers)>=2:
            a,b=map(float,numbers[:2])
            if 47<a<50 and 1<b<4:return b,a
            if 1<a<4 and 47<b<50:return a,b
    return None

def clean(value,limit=350):
    text=str(value or "").replace("\x00"," ").strip()
    return re.sub(r"\s+"," ",text)[:limit]

def main():
    result=[];seen=set()
    total=0
    for raw in records():
        total+=1
        p=coordinates(raw.get("coordonnees_au_format_wgs84"))
        if not p:continue
        lon,lat=p
        if not (2.15<lon<2.58 and 48.75<lat<48.97):continue
        ref=clean(raw.get("reference"),40)
        if not ref or ref in seen:continue
        seen.add(ref)
        item={
            "ref":ref,"x":round((lon-LON)*MX,1),"z":round((lat-LAT)*MZ,1),
            "name":clean(raw.get("titre_editorial_de_la_notice") or
                raw.get("denomination_de_l_edifice") or
                raw.get("autre_appellation_de_l_edifice"),150),
            "category":clean(raw.get("denomination_de_l_edifice"),150),
            "currentUse":clean(raw.get("destination_actuelle_de_l_edifice"),150),
            "address":clean(raw.get("adresse_forme_editoriale"),160),
            "protection":clean(raw.get("nature_de_la_protection"),180),
            "date":clean(raw.get("datation_de_l_edifice"),150),
            "author":clean(raw.get("auteur_de_l_edifice"),160),
            "materials":clean(raw.get("materiaux_du_gros_oeuvre"),180),
            "roof":clean(raw.get("materiaux_de_la_couverture"),180),
            "description":clean(raw.get("description_de_l_edifice"),500),
            "sourceUrl":"https://pop.culture.gouv.fr/notice/merimee/"+ref
        }
        if item["name"]:result.append(item)
    if len(result)<100:raise ValueError(
        "Moins de 100 notices MH avec coordonnées exploitables : "+str(len(result)))
    DEST.parent.mkdir(parents=True,exist_ok=True)
    DEST.write_text(json.dumps({"schema":1,"source":"POP/Mérimée, ministère de la Culture",
        "license":"Licence Ouverte, données ministérielles",
        "extractedAt":datetime.now(timezone.utc).isoformat(),
        "recordsExamined":total,"count":len(result),
        "note":"Points de notices, non géométrie des bâtiments. Un nom proche ne prouve pas l'identité.",
        "records":result},ensure_ascii=False,separators=(",",":"))+"\n",
        encoding="utf8")
    print("Notices historiques Paris",len(result),"/",total,flush=True)

if __name__=="__main__":main()
