#!/usr/bin/env python3
"""Relevé reproductible des emprises documentées de trois monuments du 4e.

Les emprises sont des polygones IGN projetés localement en mètres.
Les dimensions bbox et l'aire sont *calculées* depuis ces polygones,
pas des cotes architecturales vérifiées. Les hauteurs IGN restent les
attributs source et ne décrivent pas les pinacles, fenêtres, statues.
"""
from __future__ import annotations
import json, math
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/"public/data/metropole/architecture/survey-4e.json"
LAT=48.8545
LON=2.3537
MX=111320*math.cos(math.radians(LAT))
MZ=111132
SITES=[
 ("PA00086319","BATIMENT0000000245157267","-1_0"),
 ("PA00086250","BATIMENT0000000305564422","-1_-1"),
 ("PA00086257","BATIMENT0000000253243449","0_0")
]

def read(path):
 return json.loads((ROOT/path).read_text(encoding="utf8"))

def project(p):
 return ((p[0]-LON)*MX,(p[1]-LAT)*MZ)

def ring_inside(r,lon,lat):
 inside=False
 for i,a in enumerate(r):
  b=r[i-1]
  if (a[1]>lat)!=(b[1]>lat):
   if lon<(b[0]-a[0])*(lat-a[1])/(b[1]-a[1])+a[0]:
    inside=not inside
 return inside

def polygon_inside(polygon,lon,lat):
 return bool(polygon and polygon[0] and
     ring_inside(polygon[0],lon,lat) and
     not any(ring_inside(r,lon,lat) for r in polygon[1:]))

def area_ring(r):
 value=0
 for i,p in enumerate(r):
  x,y=project(p)
  xx,yy=project(r[(i+1)%len(r)])
  value+=x*yy-xx*y
 return abs(value)*.5

def survey():
 pop={p["ref"]:p for p in read(
  "public/data/metropole/places/monuments.json")["records"]}
 volumes=read("public/data/4e/city-volumes.json")["byId"]
 lidar=read("public/data/4e/roof-lidar.json")["byId"]
 report=read("data/quality/lidar-4e-reconstruction.json")
 results=[]
 for ref,building_id,tile_id in SITES:
  point=pop[ref]
  lon=LON+point["x"]/MX
  lat=LAT+point["z"]/MZ
  candidates=read(f"public/data/4e/tiles/{tile_id}.json")["buildings"]
  buildings=[b for b in candidates if
    any(polygon_inside(poly,lon,lat) for poly in b["polygons"])]
  matching=[b for b in buildings if b["id"]==building_id]
  if len(matching)!=1:
   raise ValueError(f"{ref}: point Mérimée non inclus dans l'emprise IGN attendue")
  b=matching[0]
  all_points=[project(p) for poly in b["polygons"] for ring in poly for p in ring]
  xs=[p[0] for p in all_points]
  ys=[p[1] for p in all_points]
  net_area=0
  for polygon in b["polygons"]:
   net_area+=area_ring(polygon[0])-sum(area_ring(r) for r in polygon[1:])
  if net_area<=0 or net_area>80000:
   raise ValueError(f"Emprise incohérente {ref}: {net_area:.1f}")
  footprint={
   "source":"IGN BD TOPO, polygone officiel WGS84",
   "projection":"Conversion métrique locale du moteur ; pas un relevé topographique Lambert-93",
   "areaMethod":"Aire horizontale calculée (anneaux extérieurs moins trous), non surface cadastrale",
   "areaM2":round(net_area,2),
   "bboxWidthM":round(max(xs)-min(xs),2),
   "bboxDepthM":round(max(ys)-min(ys),2),
   "ringCount":sum(len(poly) for poly in b["polygons"]),
   "pointCount":sum(len(ring) for poly in b["polygons"] for ring in poly),
   "heightIgnMeters":float(b["height"]),
   "heightIgnEstimated":bool(b["estimatedHeight"]),
   "heightNotice":"Hauteur attributaire IGN, non altitude du clocher ou mesure des ornements",
  }
  v=volumes.get(b["id"])
  municipal=(dict(source="Ville de Paris — Volumes bâtis, emprises seules",
   coverageFraction=v["coverage"],planarParts=len(v["parts"]),
   maxDeclaredFloors=v["maxFloors"],internalHeightsMeasured=False,
   renderableAsExact3D=False) if v else None)
  roof=lidar.get(b["id"])
  # Le rapport MNH est la preuve technique : hauteur, couverture,
  # densité et dalles ne sont affichées que s'il correspond au toit
  # réellement accepté et présent dans le jeu.
  evidence=None
  if ref=="PA00086319" and roof and (
     report.get("hotelDeVilleTarget")==b["id"] and
     report.get("hotelDeVilleRoofAccepted") is True):
   trace=report.get("hotelDeVilleDiagnostic",{})
   if (trace.get("reason")=="accepted-mosaic" and
       trace.get("sourceTiles") and
       0.95<=float(report["hotelDeVilleRoofTriangleCoverage"])<=1 and
       float(trace.get("pixelSizeMeters",0))==0.5):
    evidence={
     "source":"IGN LiDAR HD — MNH, altitudes relatives au terrain",
     "mosaicTiles":trace["sourceTiles"],
     "sourcePixelMeters":trace["pixelSizeMeters"],
     "meshGridMeters":trace["gridMeters"],
     "coverageFraction":report["hotelDeVilleRoofTriangleCoverage"],
     "triangles":trace["acceptedTriangles"],
     "measuredVertices":trace["acceptedVertexSamples"],
     "medianMnhHeightM":trace["heightMedianM"],
     "p90MnhHeightM":trace["heightP90M"],
     "maximumMnhHeightM":trace["maximumMnhSampleM"],
     "campanilePublishedHeightM":trace["publishedCampanileHeightM"],
     "publishedHeightSource":trace["publishedHeightSource"],
     "architecturalFacadesCertified":False,
     "ornamentsCertified":False
    }
  results.append({
   "ref":ref,"name":point["name"],"officialPointLocal":[point["x"],point["z"]],
   "sourceNotice":point["sourceUrl"],"ignBuildingId":b["id"],
   "tileId":tile_id,"association":"Point POP à l'intérieur de l'emprise IGN, non identification de chaque aile classée",
   "footprint":footprint,
   "cityVolumes":municipal,
   "lidarRoofMeasured":bool(roof),
   "roofEvidence":evidence,
   "architecturalFacadeMeasured":False,
   "exactMonumentModelCertified":False,
   "missing":["Plans cotés géoréférencés",
     "Élévations détaillées et ouvertures mesurées",
     "Toiture/pinacles/ornements contrôlés par des relevés actuels"]
  })
 return {"schema":1,"source":"IGN BD TOPO + notices POP/Mérimée + volumes Ville de Paris + MNH IGN",
  "measurementStatus":"mesures d'emprise calculées, pas de maquettes de façades certifiées",
  "projection":{"originLon":LON,"originLat":LAT,
   "metersPerDegreeLongitude":round(MX,8),"metersPerDegreeLatitude":MZ},
  "sites":results}

def main():
 data=survey()
 DEST.parent.mkdir(parents=True,exist_ok=True)
 DEST.write_text(json.dumps(data,ensure_ascii=False,indent=2)+"\n",encoding="utf8")
 print("Relevé architectural d'emprises :",len(data["sites"]),"sites,",
    "sans façade reconstruite arbitrairement")

if __name__=="__main__":
 main()
