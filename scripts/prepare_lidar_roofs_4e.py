#!/usr/bin/env python3
"""Reconstruction prudente des surfaces de toiture depuis MNH LiDAR HD IGN.

MNH = hauteur au-dessus du terrain, résolution 50 cm, source WMS IGN.
Seules les dalles qui intersectent le 4e sont téléchargées dans Actions.
Aucune photographie, texture ou point brut n'est distribué à Android.
Les toits dont les mesures ne concordent pas avec IGN BD TOPO sont exclus.
"""
from __future__ import annotations
import json,math,os,tempfile,statistics,time
from pathlib import Path
from urllib.request import Request,urlopen
from urllib.parse import urlparse,urlsplit,urlunsplit,parse_qsl,urlencode
from urllib.error import HTTPError,URLError
from contextlib import ExitStack
from datetime import datetime,timezone
import rasterio
import numpy as np
from shapely.geometry import shape,Polygon,Point,MultiPoint
from shapely.ops import transform,triangulate
from pyproj import Transformer
from rasterio.merge import merge
from rasterio.io import MemoryFile

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

def download_direct(url,folder):
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

def split_wms_tile_url(url):
    """Fractionner une dalle WMS 2000² en quatre sous-dalles 1000².
    Conserver la résolution physique de 50 cm et le même EPSG : aucune
    interpolation ni hauteur reconstituée par calcul.
    """
    parsed=urlsplit(url)
    if parsed.scheme!="https" or parsed.hostname not in ("data.geopf.fr","wxs.ign.fr"):
        return []
    pairs=dict(parse_qsl(parsed.query,keep_blank_values=True))
    fields={key.upper():key for key in pairs}
    if not all(key in fields for key in ("BBOX","WIDTH","HEIGHT","CRS")):
        return []
    try:
        xmin,ymin,xmax,ymax=map(float,pairs[fields["BBOX"]].split(","))
        width=int(pairs[fields["WIDTH"]])
        height=int(pairs[fields["HEIGHT"]])
    except (ValueError,TypeError):
        return []
    if (pairs[fields["CRS"]].upper()!="EPSG:2154" or
        width<1000 or height<1000 or width%2 or height%2 or
        xmax<=xmin or ymax<=ymin or
        abs((xmax-xmin)/width-.5)>.001 or
        abs((ymax-ymin)/height-.5)>.001):
        return []
    xm=(xmin+xmax)/2
    ym=(ymin+ymax)/2
    urls=[]
    for xlo,xhi in ((xmin,xm),(xm,xmax)):
        for ylo,yhi in ((ymin,ym),(ym,ymax)):
            p=pairs.copy()
            p[fields["BBOX"]]=",".join(
                f"{n:.2f}" for n in (xlo,ylo,xhi,yhi))
            p[fields["WIDTH"]]=str(width//2)
            p[fields["HEIGHT"]]=str(height//2)
            urls.append(urlunsplit((parsed.scheme,parsed.netloc,
                parsed.path,urlencode(p),"")))
    return urls

def mosaic_tiles(paths,folder):
    """Assembler les pixels MNH originaux sans rééchantillonnage.
    Les dalles doivent être sur la même grille Lambert-93 au pas 0,5 m.
    """
    with ExitStack() as stack:
        rasters=[stack.enter_context(rasterio.open(p)) for p in paths]
        first=rasters[0]
        for r in rasters:
            if r.count!=1 or r.crs!=first.crs:
                raise ValueError("Systèmes des dalles MNH incompatibles")
            if (abs(abs(r.res[0])-.5)>.01 or
                abs(abs(r.res[1])-.5)>.01):
                raise ValueError("Résolution MNH inattendue")
            if (abs((r.bounds.left-first.bounds.left)/.5-
                    round((r.bounds.left-first.bounds.left)/.5))>.01 or
                abs((r.bounds.top-first.bounds.top)/.5-
                    round((r.bounds.top-first.bounds.top)/.5))>.01):
                raise ValueError("Grilles MNH non alignées")
        arr,transform=merge(rasters,res=(.5,.5),
            nodata=first.nodata,method="first")
        if arr.ndim!=3 or arr.shape[0]!=1 or arr.size>20_000_000:
            raise ValueError("Mosaïque MNH trop grande")
        profile=first.profile.copy()
        profile.update(width=arr.shape[2],height=arr.shape[1],
            transform=transform,compress="deflate")
    output=folder/"lidar.tif"
    with rasterio.open(output,"w",**profile) as dataset:
        dataset.write(arr)
    return output

def download(url,folder,split_depth=0):
    folder.mkdir(parents=True,exist_ok=True)
    errors=[]
    for attempt in range(2):
        try:return download_direct(url,folder)
        except (HTTPError,URLError,TimeoutError) as exc:
            if isinstance(exc,HTTPError) and exc.code not in (502,503,504):
                raise
            errors.append(str(exc)[:150])
            if attempt==0:time.sleep(1)
    fragments=split_wms_tile_url(url) if split_depth<2 else []
    if not fragments:
        raise RuntimeError("Dalle MNH inaccessible : "+" ; ".join(errors))
    children=[]
    for i,part_url in enumerate(fragments):
        children.append(download(part_url,folder/str(i),split_depth+1))
    return mosaic_tiles(children,folder)

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
    # Un coin extérieur ou une cour peut avoir une direction vers le
    # centroïde située HORS du toit. Essayer les 16 directions proches,
    # en conservant exclusivement des pixels MESURÉS dans le polygone.
    # Rayon limité à 2 m : aucun comblement ni hauteur calculée.
    for distance in (.5,1.0,1.5,2.0):
        for octant in range(16):
            angle=math.tau*octant/16
            xx=x+distance*math.cos(angle)
            yy=y+distance*math.sin(angle)
            if not poly.covers(Point(xx,yy)):
                continue
            value=sample(raster,arr,xx,yy,height)
            if value is not None:
                return value
    return None

def produce_part(poly,source,grid=6.0,max_points=500,require_coverage=None,
                 trace=None):
    def reject(reason,**details):
        if trace is not None:
            trace.update({"reason":reason,**details})
        return None
    raster,arr,height=source
    xmin,ymin,xmax,ymax=poly.bounds
    if trace is not None:
        trace.update({"polygonAreaM2":round(float(poly.area),1),
            "boundaryVertexCount":len(list(poly.exterior.coords))-1,
            "gridMeters":grid})
    if poly.area>13000:return reject("polygon-exceeds-13000sqm")
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
        missing=sum(h is None for h in heights)
        if missing:
            return reject("missing-boundary-lidar",
                          missingBoundarySamples=missing,
                          sampledBoundaryVertices=len(heights),
                          ringCount=len(rings))
        if not heights:return reject("empty-boundary")
        perimeter.append(heights)
        raw.extend(ring)
    for i in np.arange(xmin+grid/2,xmax,grid):
        for j in np.arange(ymin+grid/2,ymax,grid):
            p=Point(float(i),float(j))
            if p.within(poly) and p.distance(poly.boundary)>1.5:
                raw.append((p.x,p.y))
    if trace is not None:trace["candidatePoints"]=len(raw)
    if len(raw)<3 or len(raw)>max_points:
        return reject("point-budget",maximum=max_points,actual=len(raw))
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
    if trace is not None:
        trace["acceptedTriangles"]=len(indices)//3
        trace["acceptedVertexSamples"]=len(values)
    if not indices or len(verts)<3:return reject("no-triangles")
    coverage=min(1.0,surface_mesuree/max(poly.area,1.0))
    # Pour les grandes maquettes patrimoniales, refuser un toit partiel :
    # sinon le rendu efface le toit IGN et laisse des trous béants.
    if trace is not None:trace["triangulatedCoverage"]=round(coverage,5)
    if require_coverage is not None and coverage<require_coverage:
        return reject("triangle-coverage-too-low",
                      requiredCoverage=require_coverage)
    if trace is not None:
        trace["heightMedianM"]=round(float(statistics.median(values)),2)
        trace["heightP90M"]=round(float(np.percentile(values,90)),2)
        trace["ignBuildingHeightM"]=height
    if statistics.median(values)<height*.65:
        return reject("median-height-inconsistent")
    if abs(np.percentile(values,90)-height)>max(5,height*.30):
        return reject("p90-height-inconsistent")
    # Réutiliser les mêmes hauteurs effectivement échantillonnées aux bords.
    # Une mesure manquante a déjà interrompu la reconstruction ci-dessus.
    if trace is not None:trace["reason"]="accepted"
    return {"vertices":verts,"indices":indices,
            "ringsHeights":perimeter,"sampleCount":len(values),
            "triangleCoverage":round(coverage,4)}

def reconstruct_hotel_from_adjacent_tiles(index,building,trace):
    """Relever tout le toit de l'Hôtel de Ville, traversant deux dalles.
    Aucune valeur de hauteur n'est créée entre dalles ; l'assemblage
    conserve la grille de pixels MNH d'origine en Lambert-93.
    """
    if not building:
        trace["reason"]="ign-building-missing"
        return None
    footprint=Polygon(building["polygons"][0][0],
                      building["polygons"][0][1:])
    if not footprint.is_valid:footprint=footprint.buffer(0)
    if footprint.is_empty:
        trace["reason"]="invalid-ign-polygon"
        return None
    needed=[]
    for tile in index["tiles"]:
        if not tile.get("geometry"):continue
        coverage=shape(tile["geometry"])
        if coverage.intersects(footprint):
            needed.append(tile)
    trace["sourceTiles"]=[t["id"] for t in needed]
    if len(needed)<2 or len(needed)>4:
        trace["reason"]="missing-adjacent-mnh-tiles"
        return None
    with tempfile.TemporaryDirectory() as root:
        folder=Path(root)
        files=[]
        for i,tile in enumerate(needed):
            trace["downloadingTile"]=tile["id"]
            files.append(download(tile["url"],folder/str(i)))
        combined=folder/"combined"
        combined.mkdir()
        combined_file=mosaic_tiles(files,combined)
        with rasterio.open(combined_file) as raster:
            if (raster.count!=1 or
               (raster.crs.to_epsg()!=2154 and
                "EPSG:2154" not in str(raster.crs))):
                trace["reason"]="invalid-combined-crs"
                return None
            trace["mosaicDimensions"]=[raster.width,raster.height]
            trace["pixelSizeMeters"]=round(float(abs(raster.res[0])),3)
            arr=raster.read(1)
            polygons=[polygon_meters(p) for p in building["polygons"]]
            if any(p is None for p in polygons):
                trace["reason"]="invalid-ign-polygon-meters"
                return None
            height=float(building["height"])
            parts=[]
            for poly in polygons:
                part=produce_part(poly,(raster,arr,height),
                    grid=2.5,max_points=3600,require_coverage=.95,
                    trace=trace)
                if part is None:return None
                parts.append(part)
            if not parts:
                trace["reason"]="no-usable-lidar-parts"
                return None
            trace["reason"]="accepted-mosaic"
            return {"source":"IGN LiDAR HD MNH 50 cm : dalle(s) "+
                    ",".join(t["id"] for t in needed)+
                    " (géométrie 2,5 m, hors ornements)",
                    "parts":parts}

def run():
    index=json.loads(INDEX.read_text())
    available=intersecting_tiles(index,25)
    if not available:raise RuntimeError("Aucune dalle MNH couvrant Paris 4e")
    buildings=load_buildings()
    roofs={}
    examined=set()
    failed=[]
    hotel_diag={"reason":"not-encountered-in-downloadable-tiles"}
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
                        if ident==HOTEL_DE_VILLE_ID:
                            hotel_diag={"reason":"examined","tile":tile["id"]}
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
                            trace=hotel_diag if priority else None
                            part=produce_part(poly,(raster,arr,height),
                                grid=2.5 if priority else 6.0,
                                max_points=3600 if priority else 500,
                                require_coverage=.95 if priority else None,
                                trace=trace)
                            if part is None:break
                            parts.append(part)
                        if len(parts)==len(polys) and parts:
                            roofs[ident]={"source":"LiDAR-HD MNH 50cm IGN",
                                "parts":parts}
            except Exception as exc:
                failed.append({"tile":tile["id"],"error":str(exc)[:180]})
                print("Dalle non exploitable:",str(exc)[:180],flush=True)
    # Le toit municipal chevauche deux fichiers MNH. Même si la première
    # passe sur une seule dalle a échoué, tenter l'assemblage scientifique
    # des deux rasters, sans interpolation artificielle.
    hotel_trace={"reason":"mosaic-not-started"}
    try:
        roof=reconstruct_hotel_from_adjacent_tiles(
            index,buildings.get(HOTEL_DE_VILLE_ID),hotel_trace)
        if roof is not None:
            roofs[HOTEL_DE_VILLE_ID]=roof
            examined.add(HOTEL_DE_VILLE_ID)
    except Exception as exc:
        hotel_trace.update({"reason":"mosaic-error","error":str(exc)[:200]})
    hotel_diag=hotel_trace
    print("Résultat mosaïque Hôtel de Ville :",hotel_diag,flush=True)
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
      "hotelDeVilleDiagnostic":hotel_diag,
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
