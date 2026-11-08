"""Simulation municipale : fidélité des limites institutionnelles et sauvegarde rétrocompatible."""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
def read(p):return (ROOT/p).read_text(encoding="utf-8")
class CityGovernance(unittest.TestCase):
 def test_civic_ui_is_wired(self):
  html=read("index.html")
  for id in ["municipal-room","city-prepare","city-vote","city-agenda","city-mobility",
             "city-templates","city-projects","city-quarter"]:
   self.assertIn('id="'+id+'"',html)
  ui=read("src/simulation/ui.ts")
  for fragment in ["new CityDashboard(clock","this.city.tick()",
                   "this.city.snapshot","this.city.restore(v.municipal)"]:
   self.assertIn(fragment,ui)
 def test_old_saves_are_compatible(self):
  save=read("src/simulation/saveStore.ts")
  self.assertIn("municipal?:MunicipalState;",save)
  self.assertIn("validateMunicipalState(x.municipal)",save)
  self.assertIn("export const SAVE_SCHEMA=1",save)
 def test_reference_sources_and_mobile_limits(self):
  engine=read("src/simulation/cityEngine.ts")
  self.assertIn("Les actes municipaux",engine)
  self.assertIn("163",engine)
  self.assertIn("JAMAIS",engine)
  for value in ("Île-de-France Mobilités","Préfecture de police",
                "ARS Île-de-France","DRAC","Mairie","Métropole du Grand Paris"):
   self.assertTrue(value in engine or value in read("index.html"),value)
  self.assertNotIn("new AerialLayer",read("src/main.ts"))
  self.assertIn("now-lastAux>=210",read("src/main.ts"))
  self.assertIn("rangeSquared=range*range",read("src/metroTiles.ts"))
 def test_novel_patrimony_includes_points(self):
  script=read("scripts/prepare_heritage_domains.py")
  self.assertIn('node["tourism"~"^(artwork|attraction)$"]',script)
  self.assertIn('node["amenity"="fountain"]',script)
  self.assertIn("len(result)>=5000",script)
  atlas=read("src/heritageAtlas.ts")
  self.assertIn("private pointIndex=new Map",atlas)
  self.assertIn("Point cartographique OpenStreetMap",atlas)
if __name__=="__main__":unittest.main()
