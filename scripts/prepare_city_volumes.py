#!/usr/bin/env python3
"""Volumes bâtis authentiques de la Ville de Paris, mise en correspondance IGN.

Ne produit AUCUNE hauteur absolue imaginaire. Le nombre de niveaux provenant
de Paris Data sert à reconstruire les proportions des retraits, normalisées
sur la hauteur totale mesurée dans la BD TOPO de l'IGN.

Les cas ambigus, les surplombs sans élévation de base et les emprises non
comparables sont exclus. Les 2 696 bâtiments IGN restent intacts.
Source ODbL : https://opendata.paris.fr/explore/dataset/volumesbatisparis/
"""
from __future__ import annotations
import json,math,time
from collections import defaultdict
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request,urlopen
from urllib.error import HTTPError,URLError
from shapely.geometry import shape,Polygon,MultiPolygon
from shapely.strtree import STRtree
from shapely.ops import unary_union,transform

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"public/data/4e"
OUT=DATA/"city-volumes.json"
API="https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/volumesbatisparis"
LON,LAT=2.3537,48.8545
MX=111320*math.cos(math.radians(LAT))
MZ=111132

def request_json(url):
    last=None
    for attempt in range(5):
        try:
            request=Request(url,headers={
                "Accept":"application/geo+json,application/json;q=0.9",
                "User-Agent":"Paris-3D-game/0.9 (public source ODbL; GitHub Actions)"
            })
            with urlopen(request,timeout=85) as response:
                content=response.read(35_000_000)
            return json.loads(content)
        except (HTTPError,URLError,TimeoutError,ValueError) as exc:
            last=exc
            time.sleep(min(2**attempt,12))
    raise RuntimeError("Source municipale inaccessible : "+str(last))

def records():
    # Export officiel en une seule opération; la pagination sert de repli.
    url=API+"/exports/geojson?"+urlencode({"where":"n_ar=4"})
    try:
        exported=request_json(url)
        features=exported.get("features",[])
        if exported.get("type")=="FeatureCollection" and 8200<=len(features)<=10000:
            print("Export GeoJSON intégral :",len(features),"volumes",flush=True)
            return features
        print("Export incomplet, pagination REST de secours :",len(features),flush=True)
    except Exception as exc:
        print("Export indisponible, pagination :",str(exc)[:180],flush=True)
    total=8664
    out=[]
    for offset in range(0,total,100):
        url=API+"/records?"+urlencode({
            "where":"n_ar=4","limit":100,"offset":offset,
            "order_by":"objectid"
        })
        data=request_json(url)
        if offset==0:
            total=int(data.get("total_count",0))
            if not 8200<=total<=10000:
                raise RuntimeError(f"Compte parisien inattendu : {total}")
        rows=data.get("results",[])
        for row in rows:
            if "geom" not in row:continue
            out.append({"type":"Feature","geometry":row["geom"],
                        "properties":row})
        if offset%1000==0:
            print(f"Volumes récupérés : {len(out)}/{total}",flush=True)
        time.sleep(.13)
    if len(out)!=total:raise RuntimeError(
        f"Extraction partielle : {len(out)}/{total}")
    return out

def as_meters(geom):
    return transform(lambda x,y,z=None:((x-LON)*MX,(y-LAT)*MZ),geom)

def original_buildings():
    all_buildings={}
    for path in sorted((DATA/"tiles").glob("*.json")):
        for b in json.loads(path.read_text(encoding="utf-8"))["buildings"]:
            pieces=[]
            for part in b["polygons"]:
                if not part:continue
                poly=Polygon(part[0],part[1:])
                if not poly.is_valid:poly=poly.buffer(0)
                if not poly.is_empty:pieces.append(poly)
            if not pieces:continue
            full=unary_union(pieces)
            if full.is_empty:continue
            full=as_meters(full)
            all_buildings[b["id"]]=full
    return all_buildings

def floors_of(row):
    try:
        count=float(row.get("nb_pl") or 0)
        if 1<=count<=50:return round(count)
    except (ValueError,TypeError):
        pass
    try:
        count=float(row.get("h_et_max") or -1)
        if 0<=count<=49:return round(count)+1
    except (ValueError,TypeError):
        pass
    return None

def rings(poly):
    if not poly.is_valid:poly=poly.buffer(0)
    if poly.is_empty:return []
    result=[]
    parts=[poly] if isinstance(poly,Polygon) else list(getattr(poly,"geoms",[]))
    for item in parts:
        if not isinstance(item,Polygon) or item.area<3:continue
        if len(item.exterior.coords)>400:continue
        ri=[]
        for ring in [item.exterior,*item.interiors]:
            coords=[[round(x,2),round(z,2)] for x,z in ring.coords]
            if len(coords)>=4:ri.append(coords)
        if ri:result.append(ri)
    return result

def build():
    features=records()
    buildings=original_buildings()
    geoms=list(buildings.values())
    ids=list(buildings.keys())
    tree=STRtree(geoms)
    matches=defaultdict(list)
    rejected=defaultdict(int)
    for f in features:
        row=f.get("properties") or {}
        if row.get("b_rdc") not in (None,1,1.0):
            rejected["surplomb_hors_sol"]+=1
            continue
        floors=floors_of(row)
        if floors is None:
            rejected["niveaux_absents"]+=1
            continue
        try:
            geom=as_meters(shape(f["geometry"]))
        except (ValueError,TypeError,KeyError):
            rejected["geometrie_invalide"]+=1
            continue
        if not geom.is_valid:geom=geom.buffer(0)
        if geom.is_empty or geom.area<4:
            rejected["petite_geometrie"]+=1
            continue
        candidates=[]
        for index in tree.query(geom):
            i=int(index)
            area=geom.intersection(geoms[i]).area
            score=area/geom.area if geom.area else 0
            if score>.11:candidates.append((score,i))
        candidates.sort(reverse=True)
        if not candidates or candidates[0][0]<.86:
            rejected["hors_emprise_IGN"]+=1
            continue
        if len(candidates)>1 and candidates[1][0]>.22:
            rejected["correspondance_ambigue"]+=1
            continue
        quality,i=candidates[0]
        clipped=geom.intersection(geoms[i])
        clipped=clipped.simplify(.15,preserve_topology=True)
        polygons=rings(clipped)
        if not polygons:
            rejected["contour_inexploitable"]+=1
            continue
        matches[ids[i]].append({
            "id":str(row.get("objectid") or row.get("n_sq_vb") or ""),
            "floors":floors,
            "score":round(quality,3),
            "area":round(clipped.area,1),
            "polygons":polygons
        })
    accepted={}
    excluded_buildings=defaultdict(int)
    for id,parts in matches.items():
        base=buildings[id]
        if len(parts)<2 or len(parts)>35:
            excluded_buildings["volume_unique_ou_trop_nombreux"]+=1
            continue
        steps={x["floors"] for x in parts}
        if len(steps)<2:
            excluded_buildings["niveaux_identiques"]+=1
            continue
        candidates=[]
        for p in parts:
            pp=[]
            for shape_set in p["polygons"]:
                try:pp.append(Polygon(shape_set[0],shape_set[1:]))
                except (TypeError,ValueError):pass
            if pp:candidates.append(unary_union(pp))
        if len(candidates)!=len(parts):continue
        cover=unary_union(candidates).intersection(base).area/max(base.area,.01)
        overlaps=sum(p.area for p in candidates)-unary_union(candidates).area
        if cover<.76:
            excluded_buildings["couverture_insuffisante"]+=1
            continue
        if overlaps>max(base.area*.06,15):
            excluded_buildings["volumes_superposes"]+=1
            continue
        accepted[id]={
          "coverage":round(cover,3),
          "maxFloors":max(steps),
          "parts":[{"id":p["id"],"floors":p["floors"],
                    "polygons":p["polygons"]} for p in parts]
        }
    allParts=sum(len(x["parts"]) for x in accepted.values())
    result={
        "schema":1,
        "source":"Ville de Paris, Volumes bâtis",
        "license":"ODbL 1.0",
        "sourceURL":"https://opendata.paris.fr/explore/dataset/volumesbatisparis/",
        "description":"Emprises mesurées; étagement relatif estimé, plafonné par la hauteur totale IGN",
        "officialVolumes":len(features),
        "matchedBuildings":len(accepted),
        "renderedParts":allParts,
        "rejectedVolumes":dict(rejected),
        "excludedBuildings":dict(excluded_buildings),
        "byId":accepted
    }
    if len(accepted)<100:
        raise RuntimeError(
            "Jointure trop faible : seulement "+str(len(accepted))+
            " bâtiments. Aucune publication de données douteuses.")
    return result

def main():
    result=build()
    OUT.parent.mkdir(parents=True,exist_ok=True)
    temp=OUT.with_suffix(".tmp")
    temp.write_text(json.dumps(result,ensure_ascii=False,
      separators=(",",":"))+"\n",encoding="utf-8")
    temp.replace(OUT)
    print("Succès jointure :",result["matchedBuildings"],
          "bâtiments IGN, ",result["renderedParts"],"volumes distincts, sur",
          result["officialVolumes"],"volumes municipaux.",flush=True)
    print("Rejets :",result["rejectedVolumes"],result["excludedBuildings"],flush=True)

if __name__=="__main__":
    main()
