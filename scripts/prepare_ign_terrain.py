#!/usr/bin/env python3
"""Modèle de terrain réellement mesuré : IGN RGE ALTI, échantillons 200 m.

Source officielle Géoplateforme; grille GCS WGS84 convertie en coordonnées
locales métriques du moteur. Aucune altitude fabriquée en cas de trou.
Les bâtiments/arbres/sols sont décalés selon la même grille interpolée.
Ceci n'est PAS la résolution native LiDAR HD ni un relevé à 1 m.
"""
from __future__ import annotations
import json,math,struct,time
from datetime import datetime,timezone
from pathlib import Path
from urllib.request import Request,urlopen

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/"public/data/metropole/terrain"
API="https://data.geopf.fr/altimetrie/1.0/calcul/alti/rest/elevation.json"
LON,LAT=2.3537,48.8545
MX=111320*math.cos(math.radians(LAT)); MZ=111132
X0=-18000;Z0=-14000;STEP=200
W=181;H=141
# Centre historique, seulement un datum d'affichage (pas une altitude officielle).
DATUM=35.0
NODATA=-32768


def request(points):
    body={
      "lon":"|".join(f"{LON+x/MX:.7f}" for x,z in points),
      "lat":"|".join(f"{LAT+z/MZ:.7f}" for x,z in points),
      "resource":"ign_rge_alti_wld","delimiter":"|",
      "indent":"false","measures":"false","zonly":"true"}
    data=json.dumps(body).encode("utf8")
    last=None
    for n in range(5):
        try:
            req=Request(API,data=data,headers={
                "Accept":"application/json","Content-Type":"application/json",
                "User-Agent":"PARIS-SKYLINES-official-terrain/0.19"},method="POST")
            with urlopen(req,timeout=140) as response:
                payload=json.load(response)
            values=payload.get("elevations",[])
            if len(values)!=len(points):
                raise ValueError("IGN a renvoyé un nombre inattendu d'altitudes")
            return [float(row["z"] if isinstance(row,dict) else row) for row in values]
        except Exception as exc:
            last=exc
            if n<4:time.sleep(2.0*(n+1))
    raise RuntimeError("RGE ALTI indisponible : "+str(last))


def main():
    points=[(X0+x*STEP,Z0+z*STEP) for z in range(H) for x in range(W)]
    result=[]
    batch_size=800
    for start in range(0,len(points),batch_size):
        chunk=points[start:start+batch_size]
        result.extend(request(chunk))
        if start%(batch_size*10)==0:print("Relief IGN",start,"/",len(points),flush=True)
        time.sleep(.24) # limite IGN : 5 requêtes par seconde
    if len(result)!=W*H:raise ValueError("Grille RGE ALTI tronquée")
    valid=[v for v in result if math.isfinite(v) and 0<=v<400]
    if len(valid)/len(result)<.96:
        raise ValueError("Échantillonnage altimétrique incomplet, conservation du sol plat")
    encoded=[]
    for val in result:
        if not math.isfinite(val) or not 0<=val<400:
            encoded.append(NODATA)
        else:
            code=round((val-DATUM)*10)
            if not -32767<=code<=32767:raise ValueError("Altitude hors int16")
            encoded.append(code)
    DEST.mkdir(parents=True,exist_ok=True)
    (DEST/"elevation.bin").write_bytes(struct.pack("<"+"h"*len(encoded),*encoded))
    manifest={
        "schema":1,"source":"IGN Géoplateforme RGE ALTI",
        "sourceUrl":"https://data.geopf.fr/altimetrie/resources/ign_rge_alti_wld",
        "serviceUrl":API,"license":"Licence Ouverte 2.0",
        "measured":True,"gridSpacingMeters":STEP,
        "extent":{"x":X0,"z":Z0,"width":W,"height":H},
        "displayReferenceAltitudeM":DATUM,
        "precision":"Interpolation bilinéaire d'échantillons RGE ALTI tous les 200 m; relief approximatif entre nœuds.",
        "validSamples":len(valid),"samples":len(result),
        "minAltitudeM":round(min(valid),2),"maxAltitudeM":round(max(valid),2),
        "extractedAt":datetime.now(timezone.utc).isoformat()
    }
    (DEST/"manifest.json").write_text(json.dumps(manifest,ensure_ascii=False,
       separators=(",",":"))+"\n",encoding="utf8")
    print("Relief IGN",len(valid),"/",len(result),
        "min-max",manifest["minAltitudeM"],manifest["maxAltitudeM"],flush=True)


if __name__=="__main__":main()
