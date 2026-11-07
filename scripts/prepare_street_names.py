#!/usr/bin/env python3
"""Noms de voies géolocalisés, référentiel officiel des voies actuelles de Paris.

Les noms et emprises viennent de la Ville de Paris, sans génération fictive.
Chaque voie du 4e possédant un nom et une géométrie dispose d'un repère.
Les voies longues reçoivent des repères répétés, tous dans leur emprise réelle.
L'affichage côté téléphone ne commence qu'en vue rapprochée.
"""
from __future__ import annotations

import json
import math
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from urllib.error import HTTPError, URLError

from shapely.geometry import box, shape
from shapely.affinity import rotate
from shapely.ops import transform

CENTER_LON, CENTER_LAT = 2.3537, 48.8545
METERS_X = 111320 * math.cos(math.radians(CENTER_LAT))
METERS_Z = 111132

def ll_to_xy(lon, lat):
    return (lon - CENTER_LON) * METERS_X, (lat - CENTER_LAT) * METERS_Z

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public/data/4e/street-names.json"
BOUNDARY = ROOT / "public/data/4e/boundary.geojson"
API = ("https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/"
       "denominations-emprises-voies-actuelles/records")
LICENSE = "ODbL 1.0"

def fetch_page(offset):
    params = {"refine": "arrdt:04e", "limit": 100, "offset": offset}
    url = API + "?" + urlencode(params)
    last = None
    for attempt in range(4):
        try:
            req = Request(url, headers={"Accept":"application/json",
                  "User-Agent":"PARIS-city-game/0.4 (non-commercial)"})
            with urlopen(req, timeout=60) as response:
                data = json.load(response)
            if not isinstance(data,dict) or not isinstance(data.get("results"), list):
                raise ValueError("Réponse Paris Data invalide")
            return data
        except (HTTPError, URLError, TimeoutError, ValueError, OSError) as exc:
            last=exc
            time.sleep(1 + 2**attempt)
    raise RuntimeError("Noms des voies indisponibles : " + str(last))

def normalize(value):
    if not isinstance(value,str): return ""
    return " ".join(value.replace("\x00"," ").split()).strip()

def street_name(record):
    name=normalize(record.get("nomvoie"))
    if not name: return None
    type_name=normalize(record.get("typvoie"))
    pre_name=normalize(record.get("prevoie"))
    words=[v for v in (type_name, pre_name, name) if v]
    return " ".join(words).replace("  "," ").strip()

def local(x,y,z=None):
    return ll_to_xy(x,y)

def polygon_parts(geom):
    if geom.is_empty: return []
    if geom.geom_type=="Polygon": return [geom]
    if geom.geom_type in ("GeometryCollection","MultiPolygon"):
        return [p for item in geom.geoms for p in polygon_parts(item)]
    return []

def street_angle(geom):
    rectangle=geom.minimum_rotated_rectangle
    if rectangle.geom_type!="Polygon": return 0.
    coords=list(rectangle.exterior.coords)
    edge=max(( (math.hypot(b[0]-a[0],b[1]-a[1]),a,b)
               for a,b in zip(coords,coords[1:])),key=lambda x:x[0])
    a,b=edge[1:]
    return round(math.degrees(math.atan2(b[1]-a[1],b[0]-a[0])), 1)


def road_anchors(geom):
    """Répéter les étiquettes sur les emprises officielles, sans inventer d'axe.

    Les bandes transversales sont intersectées avec la chaussée cadastrée.
    Le point de référence reste donc toujours dans l'emprise de la voie.
    Le tracé local est approximé par l'orientation du tronçon géométrique.
    """
    projected=transform(local,geom)
    parts=sorted(polygon_parts(projected),key=lambda p:p.area,reverse=True)
    anchors=[]
    if not parts:
        return anchors
    largest=parts[0].area
    for part_index,part in enumerate(parts[:12]):
        if part_index>0 and part.area<max(12.,largest*.055):
            continue
        angle=street_angle(part)
        origin=part.centroid
        straight=rotate(part,-angle,origin=origin)
        xmin,ymin,xmax,ymax=straight.bounds
        span=xmax-xmin
        # Une rue de moins de 120 m a une seule étiquette.
        # Sur les longues emprises, une occurrence environ tous les 145 m.
        count=min(12,max(1,int((span+55)/145)))
        for i in range(count):
            px=xmin+(i+.5)*span/count
            slab=straight.intersection(box(px-22,ymin-5,px+22,ymax+5))
            if slab.is_empty:
                continue
            core=max(polygon_parts(slab),key=lambda p:p.area,default=None)
            if core is None or core.area<.7:
                continue
            sample=rotate(core.representative_point(),angle,origin=origin)
            if anchors and any(math.hypot(a["x"]-sample.x,a["z"]-sample.y)<65 for a in anchors):
                continue
            anchors.append({"x":round(sample.x,1),
                            "z":round(sample.y,1),
                            "angle":angle,
                            "length":round(span,1)})
            if len(anchors)>=20:
                return anchors
    if not anchors:
        point=parts[0].representative_point()
        anchors.append({"x":round(point.x,1),"z":round(point.y,1),
                        "angle":street_angle(parts[0]),
                        "length":round(parts[0].length,1)})
    return anchors

def encode_record(record, boundary):
    arr=record.get("arrdt") or []
    if isinstance(arr,str): arr=[arr]
    if "04e" not in arr: return None
    label=street_name(record)
    if not label: return None
    data=record.get("geo_shape")
    if not isinstance(data,dict): return None
    geo=shape(data.get("geometry") or data)
    if geo.is_empty: return None
    if not geo.is_valid: geo=geo.buffer(0)
    if geo.is_empty or not geo.intersects(boundary): return None
    geo=geo.intersection(boundary)
    anchors=road_anchors(geo)
    if not anchors: return None
    first=anchors[0]
    return {
        "id":str(record.get("id") or record.get("cvoie") or label),
        "name":label,
        "x":first["x"],
        "z":first["z"],
        "angle":first["angle"],
        "kind":normalize(record.get("typvoie")),
        "length":first["length"],
        "placements":anchors,
    }

def main():
    boundary_data=json.loads(BOUNDARY.read_text(encoding="utf-8"))
    boundary=shape(boundary_data["geometry"])
    # Légère marge pour les voies bordant deux arrondissements.
    boundary=boundary.buffer(0.00015)
    all_records=[]
    total=None
    for offset in range(0,1000,100):
        data=fetch_page(offset)
        if total is None:
            total=int(data.get("total_count",0))
            if not 100 <= total <= 750:
                raise RuntimeError("Le filtre des voies du 4e n'a pas fonctionné : "+str(total))
        all_records.extend(data["results"])
        if len(all_records)>=total: break
    if total is None or len(all_records)<total:
        raise RuntimeError(f"Pagination des voies incomplète : {len(all_records)}/{total}")
    seen=set()
    labels=[]
    no_name=0
    no_geometry=0
    for row in all_records:
        item=encode_record(row,boundary)
        if item:
            street_id=item["id"]
            if street_id in seen:
                continue
            seen.add(street_id)
            for i,anchor in enumerate(item["placements"]):
                labels.append({
                    "id":street_id+":"+str(i),
                    "streetId":street_id,
                    "name":item["name"],
                    "x":anchor["x"],
                    "z":anchor["z"],
                    "angle":anchor["angle"],
                    "kind":item["kind"],
                    "length":anchor["length"],
                })
        elif not street_name(row):
            no_name+=1
        else:
            no_geometry+=1
    if len(seen)<130:
        raise RuntimeError(f"Seulement {len(seen)} voies géolocalisées sur {total}")
    labels.sort(key=lambda a:(a["name"].casefold(),a["id"]))
    result={
      "schema":1, "source":"Ville de Paris, dénominations des emprises des voies actuelles",
      "sourceUrl":"https://opendata.paris.fr/explore/dataset/denominations-emprises-voies-actuelles/",
      "license":LICENSE, "extractedAt":datetime.now(timezone.utc).isoformat(),
      "officialCount":total, "namedStreets":len(seen),
      "unnamedOfficialRecords":no_name,"unlocatedOfficialRecords":no_geometry,
      "count":len(labels), "labels":labels,
    }
    DEST.parent.mkdir(parents=True,exist_ok=True)
    temp=DEST.with_suffix(".tmp")
    temp.write_text(json.dumps(result,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    temp.replace(DEST)
    print(f"Voies nommées du 4e : {len(seen)} voies, {len(labels)} étiquettes / {total} enregistrements officiels")
    print(f"Sans nom : {no_name}, sans géométrie exploitable : {no_geometry}")

if __name__=="__main__":
    main()
