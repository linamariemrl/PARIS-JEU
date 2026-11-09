"""Contrôle indépendant de l'assemblage raster sans interpolation de cotes."""
import json, sys, tempfile, unittest
from pathlib import Path
from urllib.parse import urlsplit,parse_qs
import numpy as np
import rasterio
from rasterio.transform import from_origin

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
from prepare_lidar_roofs_4e import split_wms_tile_url,mosaic_tiles

class LidarMosaic026(unittest.TestCase):
 def test_server_tile_is_split_into_quarters_without_resampling(self):
  records=json.loads((ROOT/"data/quality/lidar-4e-availability.json").read_text())["tiles"]
  tile=next(t for t in records if t["id"]=="metadata.11924")
  originals=parse_qs(urlsplit(tile["url"]).query)
  links=split_wms_tile_url(tile["url"])
  self.assertEqual(len(links),4)
  main=list(map(float,originals["BBOX"][0].split(",")))
  bbox=[]
  for link in links:
   args=parse_qs(urlsplit(link).query)
   self.assertEqual(args["WIDTH"],["1000"])
   self.assertEqual(args["HEIGHT"],["1000"])
   self.assertEqual(args["CRS"],["EPSG:2154"])
   sub=list(map(float,args["BBOX"][0].split(",")))
   self.assertAlmostEqual((sub[2]-sub[0])/1000,.5)
   self.assertAlmostEqual((sub[3]-sub[1])/1000,.5)
   bbox.append(sub)
  self.assertAlmostEqual(min(a[0] for a in bbox),main[0])
  self.assertAlmostEqual(min(a[1] for a in bbox),main[1])
  self.assertAlmostEqual(max(a[2] for a in bbox),main[2])
  self.assertAlmostEqual(max(a[3] for a in bbox),main[3])
  self.assertAlmostEqual(sum((a[2]-a[0])*(a[3]-a[1]) for a in bbox),
    (main[2]-main[0])*(main[3]-main[1]))
 def test_mosaic_preserves_every_original_pixel(self):
  with tempfile.TemporaryDirectory() as directory:
   root=Path(directory)
   files=[]
   examples=[
    (0.0,np.array([[10,11],[12,13]],dtype="float32")),
    (1.0,np.array([[20,21],[22,23]],dtype="float32"))
   ]
   for i,(left,values) in enumerate(examples):
    path=root/f"{i}.tif"
    with rasterio.open(path,"w",driver="GTiff",width=2,height=2,
        count=1,dtype="float32",crs="EPSG:2154",
        transform=from_origin(left,2.0,.5,.5),nodata=-9999) as ds:
     ds.write(values,1)
    files.append(path)
   out=root/"out";out.mkdir()
   path=mosaic_tiles(files,out)
   with rasterio.open(path) as ds:
    self.assertEqual(ds.res,(.5,.5))
    self.assertEqual((ds.width,ds.height),(4,2))
    self.assertEqual(ds.crs.to_epsg(),2154)
    self.assertEqual(ds.read(1).tolist(),
     [[10.0,11.0,20.0,21.0],[12.0,13.0,22.0,23.0]])
 def test_mosaic_is_not_presented_as_certified_facade(self):
  s=(ROOT/"scripts/prepare_lidar_roofs_4e.py").read_text()
  self.assertIn('require_coverage=.95',s)
  self.assertIn('reconstruct_hotel_from_adjacent_tiles',s)
  self.assertIn('"hotelDeVilleRoofAccepted"',s)
  doc=(ROOT/"public/data/metropole/architecture/survey-4e.json").read_text()
  self.assertIn('"architecturalFacadeMeasured": false',doc)

if __name__=="__main__":unittest.main()
