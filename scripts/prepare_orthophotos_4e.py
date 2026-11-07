#!/usr/bin/env python3
"""Préparer une mosaïque photographique authentique IGN pour PARIS (4e).
Données : BD ORTHO IGN, Licence Ouverte 2.0.
Entrée : limites géographiques de la Ville de Paris.
Sortie : JPEG géoréférencés de 300 mètres, vue d'ensemble et manifeste.

On refuse les erreurs WMS et les images artificielles. En cas d'échec, aucun
manifeste valide ne sera écrit, et la carte schématique reste accessible.
"""
from __future__ import annotations

import io
import json
import math
import os
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT=Path(__file__).resolve().parents[1]
BOUNDARY=ROOT/"public/data/4e/boundary.geojson"
OUT=ROOT/"public/data/4e/aerial"
CENTER_LON,CENTER_LAT=2.3537,48.8545
METERS_X=111320*math.cos(math.radians(CENTER_LAT))
METERS_Z=111132
TILE=300
RESOLUTION=768
SOURCE="https://data.geopf.fr/wms-r/wms"
LAYER="ORTHOIMAGERY.ORTHOPHOTOS"

def iter_lnglat(node):
    if not isinstance(node,list):return
    if len(node)>=2 and all(isinstance(i,(float,int)) for i in node[:2]):
        yield float(node[0]),float(node[1])
    else:
        for sub in node:yield from iter_lnglat(sub)

def xy_to_ll(x,z):
    return CENTER_LON+x/METERS_X,CENTER_LAT+z/METERS_Z

def get_coverage():
    data=json.loads(BOUNDARY.read_text(encoding="utf-8"))
    coords=list(iter_lnglat(data["geometry"]["coordinates"]))
    if len(coords)<10:raise RuntimeError("Limite de Paris 4e vide")
    local=[((lon-CENTER_LON)*METERS_X,(lat-CENTER_LAT)*METERS_Z)
           for lon,lat in coords]
    minx=min(p[0] for p in local)
    minz=min(p[1] for p in local)
    maxx=max(p[0] for p in local)
    maxz=max(p[1] for p in local)
    # Une dalle de marge, pour voir les berges et les ponts aux limites du 4e.
    begin_x=math.floor(minx/TILE)-1
    begin_z=math.floor(minz/TILE)-1
    end_x=math.ceil(maxx/TILE)+1  # bornes exclusives
    end_z=math.ceil(maxz/TILE)+1
    if not(4<=end_x-begin_x<=13 and 4<=end_z-begin_z<=13):
        raise RuntimeError(f"Emprise suspecte ({begin_x},{begin_z},{end_x},{end_z})")
    return begin_x,begin_z,end_x,end_z

def wms_url(xmin,zmin,xmax,zmax):
    lon1,lat1=xy_to_ll(xmin,zmin)
    lon2,lat2=xy_to_ll(xmax,zmax)
    params={
      "SERVICE":"WMS","VERSION":"1.3.0","REQUEST":"GetMap",
      "LAYERS":LAYER,"STYLES":"","CRS":"CRS:84",
      "BBOX":",".join(f"{n:.9f}" for n in (lon1,lat1,lon2,lat2)),
      "WIDTH":str(RESOLUTION),"HEIGHT":str(RESOLUTION),
      "FORMAT":"image/jpeg","TRANSPARENT":"FALSE"
    }
    return SOURCE+"?"+urlencode(params)

def fetch_jpeg(xmin,zmin,xmax,zmax):
    from PIL import Image, ImageStat
    url=wms_url(xmin,zmin,xmax,zmax)
    last=None
    for attempt in range(5):
        try:
            req=Request(url,headers={
                "User-Agent":"PARIS-le-jeu-3D/0.8 (GitHub Actions, data IGN open)",
                "Accept":"image/jpeg,image/*;q=0.7",
            })
            with urlopen(req,timeout=80) as res:
                content=res.read(8_000_000)
                mime=res.headers.get("Content-Type","").lower()
            if "image" not in mime:
                raise RuntimeError(f"WMS non photographique ({mime}) : {content[:200]!r}")
            if not content.startswith(b"\xff\xd8"):
                raise RuntimeError(f"Fichier non JPEG, en-tête={content[:30]!r}")
            image=Image.open(io.BytesIO(content)).convert("RGB")
            if image.size!=(RESOLUTION,RESOLUTION):
                raise RuntimeError(f"Dimensions anormales : {image.size}")
            # Vérifie qu'une photographie n'a pas été remplacée par un carré vide.
            small=image.resize((48,48))
            variation=ImageStat.Stat(small).stddev
            if max(variation)<8:
                raise RuntimeError(f"Photographie uniforme : {variation}")
            image.save(io.BytesIO(),format="JPEG",quality=86,optimize=True)
            return image
        except (HTTPError,URLError,TimeoutError,OSError,RuntimeError) as exc:
            last=exc
            print(f"Retentative WMS {attempt+1}/5: {exc}",flush=True)
            time.sleep(min(14,2**attempt))
    raise RuntimeError(f"Photographie IGN indisponible pour {xmin},{zmin}: {last}")

def main():
    from PIL import Image
    minix,miniz,maxix,maxiz=get_coverage()
    OUT.mkdir(parents=True,exist_ok=True)
    width=(maxix-minix)*256
    height=(maxiz-miniz)*256
    overview=Image.new("RGB",(width,height))
    photos=[]
    for iz in range(miniz,maxiz):
        for ix in range(minix,maxix):
            p=OUT/f"{ix}_{iz}.jpg"
            image=None
            if p.exists():
                try:
                    image=Image.open(p).convert("RGB")
                    if image.size!=(RESOLUTION,RESOLUTION):image=None
                except OSError:image=None
            if image is None:
                image=fetch_jpeg(ix*TILE,iz*TILE,(ix+1)*TILE,(iz+1)*TILE)
                tmp=p.with_suffix(".tmp")
                image.save(tmp,format="JPEG",quality=85,optimize=True)
                tmp.replace(p)
            px=(ix-minix)*256
            py=(maxiz-1-iz)*256  # nord en haut sur les photographies
            overview.paste(image.resize((256,256),Image.Resampling.LANCZOS),
                           (px,py))
            photos.append({"id":f"{ix}_{iz}","ix":ix,"iz":iz,
                           "file":p.name,"bytes":p.stat().st_size})
            print(f"{len(photos):3d} : {p.name} ({p.stat().st_size//1024} Ko)",
                  flush=True)
            time.sleep(.13)
    overview_name="overview.jpg"
    overview.save(OUT/overview_name,format="JPEG",quality=84,optimize=True)
    bounds=[minix*TILE,miniz*TILE,maxix*TILE,maxiz*TILE]
    document={
        "schema":1,
        "source":"© IGN BD ORTHO",
        "sourceUrl":"https://www.data.gouv.fr/datasets/bd-ortho-r",
        "serviceURL":SOURCE,
        "license":"Licence Ouverte 2.0",
        "accessedAt":datetime.now(timezone.utc).isoformat(),
        "tileMeters":TILE,
        "center":[CENTER_LON,CENTER_LAT],
        "tiles":photos,
        "overview":{"file":overview_name,"bounds":bounds,
                    "bytes":(OUT/overview_name).stat().st_size},
        "totalBytes":sum(d["bytes"] for d in photos)+(OUT/overview_name).stat().st_size
    }
    if len(photos)<30:raise RuntimeError("Nombre de dalles photographiques insuffisant")
    manifest=OUT/"manifest.json"
    tmp=OUT/"manifest.tmp"
    tmp.write_text(json.dumps(document,ensure_ascii=False,indent=2)+"\n",
                   encoding="utf-8")
    tmp.replace(manifest)
    print(f"IGN ORTHO : {len(photos)} dalles de 300m, "
          f"{document['totalBytes']/1_000_000:.1f} Mo dans GitHub Pages",
          flush=True)

if __name__=="__main__":main()
