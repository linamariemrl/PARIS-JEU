"""Contrats de l'atlas touristique 0.26, sans sur-attribution foncière."""
from pathlib import Path
import json
import unittest
ROOT=Path(__file__).resolve().parents[1]
def read(p):return (ROOT/p).read_text(encoding="utf8")
class Heritage026(unittest.TestCase):
 def test_release_and_monochrome(self):
  self.assertEqual(json.loads(read("package.json"))["version"],"0.26.4")
  self.assertIn("PROTOTYPE 0.26",read("index.html"))
  self.assertIn("REVISION='0.26.4'",read("src/release.ts"))
  self.assertNotIn("new AerialLayer",read("src/main.ts"))
 def test_building_pick_and_geometry_are_independent(self):
  heritage=read("src/heritageAtlas.ts")
  for v in ["ringContains(", "footprintContains(", "tagHeritageBuilding(", "appendDetails(", "drawBoundaries(", "monuments.json","heritage-areas.json"]:
   self.assertIn(v,heritage)
  self.assertIn("b.heritageRef?[beigeWalls,beigeRoofs]",read("src/buildings.ts"))
  self.assertIn("politicalWall",read("src/buildings.ts"))
  self.assertIn("financialWall",read("src/buildings.ts"))
  self.assertIn("tagHeritageBuilding(building)",read("src/metroTiles.ts"))
  self.assertIn("data.buildings.forEach(tagHeritageBuilding)",read("src/tileManager.ts"))
 def test_areas_use_retrieved_not_invented_geometry(self):
  src=read("scripts/prepare_heritage_domains.py")
  self.assertIn("https://api.openstreetmap.org/api/0.6/way/",src)
  self.assertIn("Jardin du Luxembourg",src)
  self.assertIn("Jardin des Tuileries",src)
  self.assertIn("pas de polygone fictif",src)
 def test_park_details_are_documented_and_not_fabricated(self):
  generator=read("scripts/prepare_heritage_gardens.py")
  for s in ["scope=unary_union(domains)","p.intersection(scope)",
    "line.intersection(scope)","aucune géométrie générée"]:
   self.assertIn(s,generator)
  renderer=read("src/heritageGardens.ts")
  self.assertIn("appendDraped(",renderer)
  self.assertIn("thinInstanceSetBuffer",renderer)
  self.assertIn("heritageGardens.init()",read("src/main.ts"))
  self.assertIn("id=\"heritage-gardens-status\"",read("index.html"))
 def test_preexisting_save_contract(self):
  self.assertIn("this.captureView()",read("src/simulation/ui.ts"))
  self.assertIn("if(restoredView!==undefined)camera.restoreView(restoredView)",read("src/main.ts"))
if __name__=="__main__":unittest.main()
