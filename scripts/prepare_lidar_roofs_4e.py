#!/usr/bin/env python3
"""Reconstruction prudente des surfaces de toiture depuis MNH LiDAR HD IGN.

MNH = hauteur au-dessus du terrain, résolution 50 cm, source WMS IGN.
Seules les dalles qui intersectent le 4e sont téléchargées dans Actions.
Aucune photographie, texture ou point brut n'est distribué à Android.
Les toits dont les mesures ne concordent pas avec IGN BD TOPO sont exclus.
"""
from __future__ import annotations
import json,math,os,tempfile,statistics
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import urlparse
from datetime import datetime,timezone
import rasterio
import numpy as np
from shapely.geometry import shape,Polygon,Point,MultiPoint
from shapely.ops import transform,triangulate
from pyproj import Transformer

ROOT=Path(__file__).resolve().parents[1]
BASE=ROOT/"public/data/4e"
INDEX=ROOT/"data/quality/lidar-4e-availability.json"
OUT=BASE/"roof-lidar.json"
REPORT=ROOT/"data/quality/lidar-4e-reconstruction.json"
TO_M=Transformer.from_crs("EPSG:4326","EPSG:2154",always_xy=True).transform
TO_LL=Transformer.from_crs("EPSG:2154","EPSG:4326",always_xy=True).transform
LON,LAT=2.3537,48.8545
MX=111320*math.cos(math.radians(LAT)),111132
MAX_BYTES=58*1024*1024
MIN_MATCH=100
# Le grand Hôtel de Ville compte 592 sommets IGN, donc dépassait la limite
# générale de 500 points AVANT même l'échantillonnage de la toiture.
HOTEL_DE_VILLE_ID='BATIMENT0000000245157267'

def local(x,y):
    lon,lat=TO_LL(x,y)
    return [round((lon-LON)*MX[0],2),round((lat-LAT)*MX[1],2)]

def load_buildings():
    out={}
    for path in (BASE/"tiles").glob("*.json"):
        for b in json.loads(path.read_text())["buildings"]:
            out[b["id"]]=b
    return out

def download(url,folder):
    u=urlparse(url)
    if u.scheme!="https" or u.hostname not in ("data.geopf.fr","wxs.ign.fr"):
        raise RuntimeError("URL LiDAR non approuvée: "+u.hostname)
    filename=folder/"lidar.tif"
    req=Request(url,headers={"User-Agent":"PARIS-3D-MNH-LiDAR/0.14",
                             "Accept":"image/tiff,image/geotiff,*/*"})
    total=0
    with urlopen(req,timeout=140) as response,open(filename,"wb") as dest:
        magic=response.read(8)
        if not (magic[:4] in (b"II*\x00",b"MM\x00*")):
            raise RuntimeError("La source ne renvoie pas de GeoTIFF")
        dest.write(magic);total+=len(magic)
        while True:
            chunk=response.read(1<<19)
            if not chunk:break
            total+=len(chunk)
            if total>MAX_BYTES:raise RuntimeError("Dalle MNH trop lourde")
            dest.write(chunk)
    return filename

def intersecting_tiles(index,limit):
    boundary=shape(json.loads((BASE/"boundary.geojson").read_text())["geometry"])
    records=[]
    for t in index["tiles"]:
        geo=t.get("geometry")
        if not geo:continue
        geom=shape(geo)
        if not geom.is_valid:geom=geom.buffer(0)
        if geom.is_empty or not geom.intersects(boundary):continue
        records.append((geom.intersection(boundary).area,t,geom))
    records.sort(key=lambda a:-a[0])
    if len(records)>limit:
        raise RuntimeError("Trop de dalles MNH: "+str(len(records))+
          " > limite "+str(limit)+", élargir le quota Action")
    return records

def polygon_meters(piece):
    try:
        poly=Polygon(piece[0],piece[1:])
        if not poly.is_valid:poly=poly.buffer(0)
        if poly.is_empty or poly.geom_type!="Polygon" or poly.area<1e-11:return None
        return transform(TO_M,poly)
    except (ValueError,TypeError,IndexError):return None

def sample(raster,arr,x,y,ign_height):
    try:
        row,col=raster.index(x,y)
        if row<0 or col<0 or row>=arr.shape[0] or col>=arr.shape[1]:return None
        h=float(arr[row,col])
    except (ValueError,IndexError,OverflowError):return None
    if not math.isfinite(h) or h<=1 or h>220 or h==raster.nodata:return None
    if h<max(1.3,ign_height*.40) or h>max(10,ign_height*1.55):return None
    return round(h,2)

def verified_roof_sample(poly,raster,arr,x,y,height,center):
    """Échantillonner un vrai pixel MNH à l'intérieur du toit.
    Un bord IGN tombe fréquemment sur un pixel mêlé chaussée/toiture.
    Aucun point 3D fictif n'est ajouté ; XY reste le sommet IGN.
    """
    dx,dy=center.x-x,center.y-y
    d=max(1e-6,math.hypot(dx,dy))
    directions=[(dx/d,dy/d)]
    for length in (0.0,0.35,0.75,1.2,2.0):
        for vx,vy in directions:
            xx,yy=x+vx*length,y+vy*length
            if length>0 and not poly.covers(Point(xx,yy)):
                continue
            value=sample(raster,arr,xx,yy,height)
            if value is not None:return value
    return None

def produce_part(poly,source,grid=6.0,max_points=500,require_coverage=None):
    raster,arr,height=source
    xmin,ymin,xmax,ymax=poly.bounds
    if poly.area>13000:return None  # monuments complexes traités séparément
    center=poly.representative_point()
    raw=[]
    rings=[list(poly.exterior.coords)[:-1],*[list(r.coords)[:-1] for r in poly.interiors]]
    perimeter=[]
    for ring in rings:
        heights=[]
        for x,y in ring:
            # À la limite d'un toit, le pixel LiDAR peut recouvrir la chaussée.
            # Déplacer le point échantillonné vers l'intérieur, sans bouger sa
            # position XY dans la maquette.
            h=verified_roof_sample(poly,raster,arr,x,y,height,center)
            heights.append(h)
        if not heights or any(x is None for x in heights):return None
        perimeter.append(heights)
        raw.extend(ring)
    for i in np.arange(xmin+grid/2,xmax,grid):
        for j in np.arange(ymin+grid/2,ymax,grid):
            p=Point(float(i),float(j))
            if p.within(poly) and p.distance(poly.boundary)>1.5:
                raw.append((p.x,p.y))
    if len(raw)<3 or len(raw)>max_points:return None
    # Contraintes : les triangles ne doivent pas traverser les cours intérieures.
    candidates=triangulate(MultiPoint(raw))
    unique={}
    verts=[]
    indices=[]
    values=[]
    surface_mesuree=0.0
    for triangle in candidates:
        if not triangle.representative_point().within(poly):continue
        if triangle.intersection(poly).area/max(triangle.area,.0001)<.995:continue
        ids=[]
        valid=True
        for x,y in list(triangle.exterior.coords)[:3]:
            key=(round(x,2),round(y,2))
            if key not in unique:
                h=verified_roof_sample(poly,raster,arr,x,y,height,center)
                if h is None:
                    # Les toits LiDAR incohérents sont exclus, jamais complétés
                    # par une hauteur imaginée.
                    valid=False
                    break
                unique[key]=len(verts)
                xy=local(x,y)
                verts.append([xy[0],xy[1],h])
                values.append(h)
            ids.append(unique[key])
        if valid and len(set(ids))==3:
            indices.extend(ids)
            surface_mesuree+=triangle.area
    if not indices or len(verts)<3:return None
    coverage=min(1.0,surface_mesuree/max(poly.area,1.0))
    # Pour les grandes maquettes patrimoniales, refuser un toit partiel :
    # sinon le rendu efface le toit IGN et laisse des trous béants.
    if require_coverage is not None and coverage<require_coverage:
        return None
    if statistics.median(values)<height*.65:
        return None
    if abs(np.percentile(values,90)-height)>max(5,height*.30):
        return None
    # Réutiliser les mêmes hauteurs effectivement échantillonnées aux bords.
    # Une mesure manquante a déjà interrompu la reconstruction ci-dessus.
    return {"vertices":verts,"indices":indices,
            "ringsHeights":perimeter,"sampleCount":len(values),
            "triangleCoverage":round(coverage,4)}

def run():
    index=json.loads(INDEX.read_text())
    available=intersecting_tiles(index,25)
    if not available:raise RuntimeError("Aucune dalle MNH couvrant Paris 4e")
    buildings=load_buildings()
    roofs={}
    examined=set()
    failed=[]
    # Une dalle peut traverser plusieurs bâtiments, mais un bâtiment n'est
    # retenu qu'avec un raster unique couvrant son centroïde.
    for order,(_,tile,footprint) in enumerate(available,1):
        print(f"Dalle {order}/{len(available)}: {tile['id']}",flush=True)
        with tempfile.TemporaryDirectory() as temp:
            try:
                file=download(tile["url"],Path(temp))
                with rasterio.open(file) as raster:
                    if raster.crs is None or raster.count!=1:
                        raise RuntimeError("Référencement raster absent")
                    # Les GeoTIFF issus du WMS IGN portent parfois un WKT
                    # "PROJCS[EPSG:2154,...]" sans autorité EPSG reconnue
                    # par GDAL. Vérifier également les bornes et le pixel,
                    # jamais la seule chaîne de caractères.
                    crs=str(raster.crs)
                    if raster.crs.to_epsg()!=2154 and "EPSG:2154" not in crs:
                        raise RuntimeError("Projection MNH inattendue: "+crs[:150])
                    bounds=raster.bounds
                    if not (630000<bounds.left<680000 and
                            6840000<bounds.bottom<6900000 and
                            .45<abs(raster.res[0])<.60 and
                            .45<abs(raster.res[1])<.60):
                        raise RuntimeError("Géoréférencement MNH suspect")
                    arr=raster.read(1)
                    source=None
                    for ident,b in buildings.items():
                        if ident in examined:continue
                        polys=[polygon_meters(p) for p in b["polygons"]]
                        polys=[p for p in polys if p is not None]
                        if not polys:continue
                        center=polys[0].representative_point()
                        lon,lat=TO_LL(center.x,center.y)
                        if not footprint.covers(Point(lon,lat)):continue
                        examined.add(ident)
                        height=float(b["height"])
                        parts=[]
                        for poly in polys:
                            if not footprint.covers(Point(TO_LL(poly.representative_point().x,
                                          poly.representative_point().y))):break
                            # L'Hôtel de Ville est traité hors de la limite
                            # simplificatrice générale, avec une grille 2,5 m.
                            # On conserve les 592 sommets officiels ; le toit
                            # n'est publié que si >=95 % de la surface est mesurée.
                            priority=(ident==HOTEL_DE_VILLE_ID)
                            part=produce_part(poly,(raster,arr,height),
                                grid=2.5 if priority else 6.0,
                                max_points=3600 if priority else 500,
                                require_coverage=.95 if priority else None)
                            if part is None:break
                            parts.append(part)
                        if len(parts)==len(polys) and parts:
                            roofs[ident]={"source":"LiDAR-HD MNH 50cm IGN",
                                "parts":parts}
            except Exception as exc:
                failed.append({"tile":tile["id"],"error":str(exc)[:180]})
                print("Dalle non exploitable:",str(exc)[:180],flush=True)
    data={"schema":1,"source":"IGN LiDAR HD MNH, 50 cm, EPSG:2154",
      "license":"Licence Ouverte 2.0",
      "sourceURL":"https://www.data.gouv.fr/datasets/mnh-lidar-hd",
      "createdAt":datetime.now(timezone.utc).isoformat(),
      "buildingCount":len(roofs),"byId":roofs}
    report={"schema":1,"testedTiles":len(available),
      "downloadFailures":failed,"coveredBuildings":len(examined),
      "validatedBuildings":len(roofs),
      "rejectedBuildings":len(examined)-len(roofs),
      "totalBuildings":len(buildings),
      "hotelDeVilleTarget":HOTEL_DE_VILLE_ID,
      "hotelDeVilleRoofAccepted":HOTEL_DE_VILLE_ID in roofs,
      "hotelDeVilleRoofTriangleCoverage":round(min(
          [p.get("triangleCoverage",0) for p in
           roofs.get(HOTEL_DE_VILLE_ID,{}).get("parts",[])],default=0),4),
      "note":"Toit mesuré seulement par échantillonnage MNH et triangulation 2,5 m ; les sculptures et façades n'en sont PAS déduites."}
    REPORT.parent.mkdir(parents=True,exist_ok=True)
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    if len(roofs)<MIN_MATCH:
        print("Moins de 100 toitures fiables, aucune superposition LiDAR publiée",flush=True)
        return
    OUT.write_text(json.dumps(data,ensure_ascii=False,separators=(",",":"))+"\n",encoding="utf-8")
    print("Toitures LiDAR validées:",len(roofs),"sur",len(buildings),flush=True)

if __name__=="__main__":
    run()
