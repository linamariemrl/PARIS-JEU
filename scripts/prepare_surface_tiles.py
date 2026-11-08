#!/usr/bin/env python3
"""Découpe SIG en secteurs 2,4 km : emprises exactes près, simplifiées au loin.

Le LOD lointain simplifie uniquement les contours existants. Il peut
omettre les fragments de chaussée trop petits pour être perceptibles ;
aucune forme géographique n'est inventée.
"""
from __future__ import annotations
import json
import math
from collections import defaultdict
from pathlib import Path
from shapely.geometry import Polygon, box

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"public/data/metropole/surfaces"
OUT=SOURCE/"tiles"
STEP=2400
INPUTS=("green","water","roads")
KINDS={"managed","wood","planted","water","road"}
FAR_AREA={"managed":50,"wood":50,"planted":50,"water":90,"road":650}

def parts(geom):
    if geom.is_empty:return
    if geom.geom_type=="Polygon":
        yield geom
    elif geom.geom_type in ("MultiPolygon","GeometryCollection"):
        for element in geom.geoms:
            yield from parts(element)

def rings(poly):
    return [[[round(x,2),round(z,2)] for x,z in ring.coords]
        for ring in (poly.exterior,*poly.interiors) if len(ring.coords)>=4]

def split(kind,raw,tiles):
    if not raw or len(raw[0])<4:return
    shape=Polygon(raw[0],raw[1:])
    if not shape.is_valid:shape=shape.buffer(0)
    if shape.is_empty:return
    xmin,zmin,xmax,zmax=shape.bounds
    if not all(math.isfinite(v) and abs(v)<40000 for v in
               (xmin,zmin,xmax,zmax)):raise ValueError("Emprise SIG hors Paris")
    ix0,ix1=math.floor(xmin/STEP),math.floor(xmax/STEP)
    iz0,iz1=math.floor(zmin/STEP),math.floor(zmax/STEP)
    if (ix1-ix0+1)*(iz1-iz0+1)>150:
        raise ValueError("Emprise SIG trop vaste")
    for ix in range(ix0,ix1+1):
        for iz in range(iz0,iz1+1):
            cell=box(ix*STEP,iz*STEP,(ix+1)*STEP,(iz+1)*STEP)
            if not shape.intersects(cell):continue
            key=f"{ix}_{iz}"
            for piece in parts(shape.intersection(cell)):
                if piece.area<3:continue
                contour=rings(piece)
                if contour:tiles[key]["near"].append([kind,contour])
                if piece.area<FAR_AREA[kind]:continue
                coarse=piece.simplify(1.8,preserve_topology=True)
                for smooth in parts(coarse):
                    if smooth.area<FAR_AREA[kind]:continue
                    coords=rings(smooth)
                    if coords:tiles[key]["far"].append([kind,coords])

def main():
    tiles=defaultdict(lambda:{"near":[],"far":[]})
    counts={}
    for name in INPUTS:
        file=SOURCE/(name+".json")
        data=json.loads(file.read_text(encoding="utf8"))
        if data.get("schema")!=1 or data.get("count")!=len(data["features"]):
            raise ValueError("Source vérifiée invalide : "+name)
        counts[name]=len(data["features"])
        for feature in data["features"]:
            kind=feature.get("kind")
            if kind not in KINDS:raise ValueError("Nature inconnue : "+str(kind))
            for poly in feature["polygons"]:
                split(kind,poly,tiles)
    if len(tiles)<20:raise ValueError("Couverture trop faible")
    OUT.mkdir(parents=True,exist_ok=True)
    for path in OUT.glob("*.json"):path.unlink()
    manifest={"schema":1,"cellMeters":STEP,"sourceCounts":counts,
        "source":"IGN BD TOPO et Paris Data",
        "note":"Près = contours réels; loin = contours simplifiés et fragments minuscules omis.",
        "tiles":[]}
    for key,features in sorted(tiles.items()):
        ix,iz=map(int,key.split("_"))
        near=features["near"];far=features["far"]
        for lod,records in (("near",near),("far",far)):
            file=OUT/(f"{key}-{lod}.json")
            file.write_text(json.dumps({"schema":1,"features":records},
                ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf8")
        manifest["tiles"].append({"id":key,"ix":ix,"iz":iz,
             "near":len(near),"far":len(far)})
    (OUT/"manifest.json").write_text(json.dumps(manifest,
        ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf8")
    print("Tuiles surfaciques:",len(tiles),counts,
          "formes proche:",sum(len(v["near"]) for v in tiles.values()),
          "formes loin:",sum(len(v["far"]) for v in tiles.values()))

if __name__=="__main__":
    main()
