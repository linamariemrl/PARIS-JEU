#!/usr/bin/env python3
"""Préparer les bâtiments BD TOPO de Paris et communes limitrophes.

Les contours proviennent exclusivement du périmètre IGN calculé dans le
workflow précédent. Les 2696 immeubles du 4e restent dans leurs tuiles
historiques et ne sont pas dupliqués. Le chargement dans le jeu est distinct.
Un budget de distribution évite de dépasser GitHub Pages.
"""
from __future__ import annotations
import json,math,time,sys
from pathlib import Path
from urllib.parse import urlencode
from urllib.request import Request,urlopen
from datetime import datetime,timezone
from shapely.geometry import shape,box,Polygon,MultiPolygon
from shapely.ops import unary_union
ROOT=Path(__file__).resolve().parents[1]
GEO=ROOT/"public/data/metropole"
OUT=GEO/"buildings"
TILES=OUT/"tiles"
IGN="https://data.geopf.fr/wfs/ows"
LON,LAT=2.3537,48.8545
MX=111320*math.cos(math.radians(LAT))
MZ=111132
TILE_M=800
COUNT=400
MAX_DISTRIBUTION=380_000_000

def local(lon,lat):return (lon-LON)*MX,(lat-LAT)*MZ
def ll(x,z):return LON+x/MX,LAT+z/MZ

def json_request(url):
    last=None
    for attempt in range(5):
        try:
            req=Request(url,headers={"Accept":"application/json",
              "User-Agent":"PARIS-le-jeu-GitHubActions/metro-batiments"})
            with urlopen(req,timeout=85) as response:
                data=json.load(response)
            if not isinstance(data,dict):raise ValueError("JSON manquant")
            return data
        except Exception as e:
            last=e
            print("Retentative:",str(e)[:130],flush=True)
            if attempt<4:time.sleep(2**attempt)
    raise RuntimeError("WFS IGN inaccessible: "+str(last))

def features(bbox):
    first_ids=set()
    for page in range(120):
        q={"SERVICE":"WFS","VERSION":"2.0.0","REQUEST":"GetFeature",
          "TYPENAMES":"BDTOPO_V3:batiment","SRSNAME":"CRS:84",
          "BBOX":",".join(f"{v:.8f}" for v in bbox)+",CRS:84",
          "COUNT":COUNT,"STARTINDEX":page*COUNT,
          "OUTPUTFORMAT":"application/json"}
        result=json_request(IGN+"?"+urlencode(q))
        entries=result.get("features")
        if result.get("type")!="FeatureCollection" or not isinstance(entries,list):
            raise RuntimeError("WFS IGN invalide")
        if entries:
            ident=str(entries[0].get("id") or
              (entries[0].get("properties") or {}).get("cleabs"))
            if ident in first_ids:raise RuntimeError("Pagination IGN répétée")
            first_ids.add(ident)
        yield from entries
        if len(entries)<COUNT:return
        time.sleep(.13)
    raise RuntimeError("Limite de pagination IGN dépassée")

def get_perimeter():
    data=json.loads((GEO/"limits.geojson").read_text(encoding="utf-8"))
    comps=[shape(f["geometry"]) for f in data["features"] if
         f["properties"]["kind"] in ("paris","commune_limitrophe")]
    if len(comps)<28:raise RuntimeError("Périmètre incomplet")
    area=unary_union(comps)
    if not area.is_valid:area=area.buffer(0)
    return area

def previous_ids():
    ids=set()
    for f in (ROOT/"public/data/4e/tiles").glob("*.json"):
        doc=json.loads(f.read_text(encoding="utf-8"))
        ids.update(b["id"] for b in doc["buildings"])
    if len(ids)!=2696:raise RuntimeError("4e IGN absent")
    return ids

def rings_of(polygon):
    polygons=[polygon] if isinstance(polygon,Polygon) else (
      list(polygon.geoms) if isinstance(polygon,MultiPolygon) else [])
    output=[]
    for p in polygons:
        if p.is_empty or p.area<1e-11:continue
        rings=[]
        for ring in [p.exterior,*p.interiors]:
            values=[[round(local(lon,lat)[0],2),
                     round(local(lon,lat)[1],2)] for lon,lat in ring.coords]
            if len(values)>=4:rings.append(values)
        if rings:output.append(rings)
    return output

def clean(item,perimeter,ix,iz):
    raw=item.get("geometry")
    if not raw:return None
    geom=shape(raw)
    if geom.is_empty or geom.geom_type not in ("Polygon","MultiPolygon"):return None
    if not geom.is_valid:geom=geom.buffer(0)
    if geom.is_empty or not geom.intersects(perimeter):return None
    geom=geom.intersection(perimeter)
    if geom.is_empty:return None
    if geom.geom_type not in ("Polygon","MultiPolygon"):
        pieces=[g for g in getattr(geom,"geoms",[]) if g.geom_type=="Polygon"]
        if not pieces:return None
        geom=unary_union(pieces)
    rp=geom.representative_point()
    x,z=local(rp.x,rp.y)
    if math.floor(x/TILE_M)!=ix or math.floor(z/TILE_M)!=iz:return None
    geom=geom.simplify(.000002,preserve_topology=True)
    polygons=rings_of(geom)
    if not polygons:return None
    props=item.get("properties") or {}
    ident=str(props.get("cleabs") or item.get("id") or "")
    if not ident:raise RuntimeError("Bâtiment sans identifiant IGN")
    try:h=float(props.get("hauteur"))
    except (TypeError,ValueError):h=0
    estimated=not math.isfinite(h) or not 2<=h<=220
    if estimated:h=15.0
    return {"id":ident,"height":round(h,2),
      "estimatedHeight":estimated,
      "usage":str(props.get("usage_1") or props.get("nature") or "Non renseigné"),
      "localCoordinates":True,
      "polygons":polygons}

def run():
    area=get_perimeter()
    existing=previous_ids()
    bbox=area.bounds
    a=local(bbox[0],bbox[1]);b=local(bbox[2],bbox[3])
    ix_min,ix_max=math.floor(a[0]/TILE_M),math.floor(b[0]/TILE_M)
    iz_min,iz_max=math.floor(a[1]/TILE_M),math.floor(b[1]/TILE_M)
    tiles={}
    seen=set()
    requests=0
    for ix in range(ix_min,ix_max+1):
      for iz in range(iz_min,iz_max+1):
        bottom=ll(ix*TILE_M,iz*TILE_M)
        top=ll((ix+1)*TILE_M,(iz+1)*TILE_M)
        cell=box(bottom[0],bottom[1],top[0],top[1])
        if not area.intersects(cell):continue
        requests+=1
        points=[]
        for item in features([bottom[0],bottom[1],top[0],top[1]]):
            bldg=clean(item,area,ix,iz)
            if not bldg or bldg["id"] in existing or bldg["id"] in seen:continue
            seen.add(bldg["id"])
            points.append(bldg)
        if points:
            tiles[f"{ix}_{iz}"]={"schema":2,"id":f"{ix}_{iz}",
                "localCoordinates":True,"buildings":points}
        if requests%20==0:print("Cellules:",requests,"bâtiments:",len(seen),flush=True)
        time.sleep(.12)
    if len(seen)<15000 or len(tiles)<60:
        raise RuntimeError("Extraction trop faible: "+str(len(seen))+
          " bâtiments dans "+str(len(tiles))+" tuiles")
    TILES.mkdir(parents=True,exist_ok=True)
    # Ne publier aucune tuile tant que tous les téléchargements n'ont pas fini.
    descriptors=[]
    total=0
    for ident,data in tiles.items():
        text=json.dumps(data,ensure_ascii=False,separators=(",",":"))
        size=len(text.encode("utf-8"))
        total+=size
        if total>MAX_DISTRIBUTION:
            raise RuntimeError("Le budget de GitHub Pages est dépassé;"+
              " utiliser un lot géographique réduit au lieu de publier")
        ix,iz=map(int,ident.split("_"))
        descriptors.append({"id":ident,"ix":ix,"iz":iz,
          "count":len(data["buildings"]),"bytes":size})
    for old in TILES.glob("*.json"):old.unlink()
    for ident,data in tiles.items():
        (TILES/(ident+".json")).write_text(json.dumps(
          data,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    result={"schema":2,"generatedAt":datetime.now(timezone.utc).isoformat(),
      "source":"IGN BD TOPO WFS Géoplateforme",
      "sourceURL":IGN,"scope":"Paris (20 arrondissements et bois) et 29 communes limitrophes",
      "tileMeters":TILE_M,"totalBuildings":len(seen),"buildingsStoredIn4e":2696,
      "bytes":total,"tiles":descriptors}
    (OUT/"manifest.json").write_text(json.dumps(result,
      ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("IGN métropole final:",len(seen),"bâtiments nouveaux,",
        len(tiles),"tuiles,",total/1e6,"Mo",flush=True)

if __name__=="__main__":run()
