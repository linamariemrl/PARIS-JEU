"""Tous les secteurs IGN sont présents même si les détails restent GPU-bornés."""
from pathlib import Path
import json
import struct
import unittest
ROOT=Path(__file__).resolve().parents[1]
COVERAGE=ROOT/"public/data/metropole/coverage"
class CityAtlas(unittest.TestCase):
 def test_all_official_buildings_counted(self):
  atlas=json.loads((COVERAGE/"manifest.json").read_text(encoding="utf8"))
  source=json.loads((ROOT/"public/data/metropole/overview/manifest.json")
                    .read_text(encoding="utf8"))
  self.assertEqual(atlas["totalBuildings"],source["totalBuildings"])
  self.assertEqual(len(atlas["groups"]),len(source["groups"]))
  self.assertEqual(atlas["representation"],"aggregated-50m-cells")
  self.assertEqual(atlas["sourceHash"],source["sourceHash"])
  total=0
  for g in atlas["groups"]:
   blob=(COVERAGE/(g["id"]+".bin")).read_bytes()
   self.assertEqual(len(blob),g["cells"]*8)
   self.assertEqual(len(blob),g["bytes"])
   counts=sum(struct.unpack_from("<H",blob,i+6)[0]
              for i in range(0,len(blob),8))
   self.assertEqual(counts,g["buildings"])
   total+=counts
  self.assertEqual(total,source["totalBuildings"])
 def test_atlas_is_used_as_geo_fallback(self):
  main=(ROOT/"src/main.ts").read_text(encoding="utf8")
  overview=(ROOT/"src/metroOverview.ts").read_text(encoding="utf8")
  coverage=(ROOT/"src/cityCoverage.ts").read_text(encoding="utf8")
  self.assertIn("coverage.init().then(()=>showCounts())",main)
  self.assertIn("radius>=5000||(this.panoramicAtlas&&radius>4000)",overview)
  self.assertIn("this.coverage?.showExcept(",overview)
  self.assertIn("this.coverage.showExcept([])",overview)
  self.assertIn("this.meshes.size!==manifest.groups.length",coverage)
  self.assertIn("this.count.toLocaleString('fr-FR')",coverage)
  self.assertIn("mesh.thinInstanceSetBuffer('matrix',matrices,16,true)",coverage)
  self.assertIn("workers=3",coverage)
  self.assertIn("this.roofsOnly?36000:16000",overview)
  self.assertNotIn("diffuseTexture",coverage)
if __name__=="__main__":unittest.main()
