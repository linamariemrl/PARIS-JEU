#!/usr/bin/env python3
"""Toutes les positions d'arbres publiées par la Ville de Paris, par tuiles.

Arbres municipaux documentés, hors arbres privés et masses forestières non
inventoriées. En cas de champ de hauteur absent, la silhouette reçoit une
hauteur conventionnelle marquée, sans fausse mesure. Données ODbL.
"""
from __future__ import annotations
import csv
import io
import json
import math
import struct
import time
from datetime import datetime,timezone
from pathlib import Path
from urllib.request import urlopen,Request
from shapely.geometry import Point,shape
from shapely.ops import unary_union
from shapely.prepared import prep

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/"public/data/metropole/trees"
URL="https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/les-arbres/exports/csv"
LON,LAT=2.3537,48.8545
MX=111320*math.cos(math.radians(LAT))
MZ=111132
TILE=800
UNIT=.25
MAX_BYTES=90_000_000
GENERA={"pinus","picea","cedrus","abies","taxus","thuja","cupressus","chamaecyparis"}


def download():
    req=Request(URL+"?select=idbase,geo_point_2d,hauteurenm,genre,circonferenceencm",
        headers={"User-Agent":"PARIS-SKYLINES-open-data/0.18",
                 "Accept":"text/csv,*/*"})
    with urlopen(req,timeout=240) as response:
        output=bytearray()
        while True:
            block=response.read(1<<20)
            if not block:break
            output.extend(block)
            if len(output)>MAX_BYTES:
                raise ValueError("CSV arbres trop lourd")
    return output.decode("utf-8-sig")


def location(value):
    if isinstance(value,dict):
        return float(value["lon"]),float(value["lat"])
    s=str(value or "").strip()
    if not s:return None
    if s.startswith("{"):
        try:
            pos=json.loads(s)
            return float(pos["lon"]),float(pos["lat"])
        except (ValueError,KeyError,TypeError):
            return None
    # Les exports Opendatasoft expriment habituellement latitude,longitude.
    parts=s.replace("POINT (","").replace(")","").replace(" ","").split(",")
    if len(parts)!=2:return None
    try:
        lat,lon=map(float,parts)
    except ValueError:
        return None
    if not (47<lat<50 and 1<lon<4):
        if 47<lon<50 and 1<lat<4:
            lon,lat=lat,lon
        else:
            return None
    return lon,lat


def radius_code(row,h):
    try:
        circum=float(str(row.get("circonferenceencm") or "").replace(",","."))
    except ValueError:
        circum=0
    diameter=circum/(100*math.pi) if 10<=circum<=900 else max(.18,min(.65,h*.042))
    return max(6,min(100,round(diameter/.02)))


def tree_record(row,perimeter,excluded):
    ident=str(row.get("idbase") or "").strip()
    if not ident or ident in excluded:return None
    coords=location(row.get("geo_point_2d"))
    if not coords:return None
    lon,lat=coords
    if not (2.14<lon<2.62 and 48.76<lat<48.96):return None
    if not perimeter.covers(Point(lon,lat)):return None
    try:
        height=float(str(row.get("hauteurenm") or "").replace(",","."))
    except ValueError:
        height=0
    if not math.isfinite(height) or not 2<=height<=38:
        height=8
    x=(lon-LON)*MX
    z=(lat-LAT)*MZ
    ix,iz=math.floor(x/TILE),math.floor(z/TILE)
    xx,zz=round((x-ix*TILE)/UNIT),round((z-iz*TILE)/UNIT)
    if not (0<=xx<=32767 and 0<=zz<=32767):
        raise ValueError("Arbre hors tuile : "+ident)
    code=min(255,max(8,round(height*4)))
    genus=str(row.get("genre") or "").lower().strip()
    tone=2 if genus in GENERA else sum(ord(c) for c in ident)%2
    return f"{ix}_{iz}",struct.pack("<hhBBB",xx,zz,code,tone,radius_code(row,height))


def main():
    data=json.loads((ROOT/"public/data/metropole/limits.geojson").read_text(
        encoding="utf-8"))
    polygons=[shape(f["geometry"]) for f in data["features"] if
        f["properties"]["kind"] in ("paris","commune_limitrophe")]
    if len(polygons)<28:raise RuntimeError("Périmètre Paris incomplet")
    perimeter=prep(unary_union(polygons))
    pilot=json.loads((ROOT/"public/data/4e/trees.json").read_text(encoding="utf-8"))
    excluded={str(t["id"]) for t in pilot["trees"]}
    content=download()
    sample=content[:8000]
    dialect=csv.Sniffer().sniff(sample,delimiters=";,\t")
    rows=csv.DictReader(io.StringIO(content),dialect=dialect)
    if not rows.fieldnames or not {"idbase","geo_point_2d"}.issubset(rows.fieldnames):
        raise ValueError("Export CSV : colonnes ID et coordonnées absentes : "+str(rows.fieldnames))
    ids=set()
    tiles:dict[str,bytearray]={}
    processed=0
    for row in rows:
        processed+=1
        ident=str(row.get("idbase") or "")
        if ident in ids:continue
        ids.add(ident)
        parsed=tree_record(row,perimeter,excluded)
        if not parsed:continue
        key,blob=parsed
        tiles.setdefault(key,bytearray()).extend(blob)
    count=sum(len(v)//7 for v in tiles.values())
    if not 50_000<=count<=400_000 or len(tiles)<60:
        raise ValueError(f"Nombre d'arbres impossible {count}, {len(tiles)} tuiles")
    OUT.mkdir(parents=True,exist_ok=True)
    for old in OUT.glob("*.bin"):old.unlink()
    manifest={"schema":1,"source":"Ville de Paris, les-arbres (Paris Data)",
      "sourceUrl":"https://opendata.paris.fr/explore/dataset/les-arbres/",
      "license":"ODbL","extractedAt":datetime.now(timezone.utc).isoformat(),
      "tileMeters":TILE,"quantizationMeters":UNIT,
      "recordBytes":7,"count":count,"rawRecords":processed,
      "excludedPilotTrees":len(excluded),
      "note":"Arbres municipaux partiels, hauteurs absentes estimées à 8 m ; houppiers symboliques.",
      "tiles":[]}
    for key,payload in sorted(tiles.items()):
        ix,iz=map(int,key.split("_"))
        (OUT/(key+".bin")).write_bytes(payload)
        manifest["tiles"].append({"id":key,"ix":ix,"iz":iz,
             "count":len(payload)//7,"bytes":len(payload)})
    (OUT/"manifest.json").write_text(
      json.dumps(manifest,ensure_ascii=False,separators=(",",":"))+"\n",
      encoding="utf-8")
    print("Arbres municipaux hors 4e:",count,"tuiles",len(tiles),
      "exports",processed,flush=True)


if __name__=="__main__":
    main()
