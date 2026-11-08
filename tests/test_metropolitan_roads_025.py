"""Contrat v0.25 : voirie PVP dans Paris entier sans recharger le moteur."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
def text(path):return (ROOT/path).read_text(encoding="utf8")

class MetropolitanRoads(unittest.TestCase):
 def test_existing_pvp_tiles_and_lod_are_used(self):
  road=text("src/metroRoads.ts")
  self.assertIn("data/metropole/surfaces/tiles/",road)
  self.assertIn("overview.json",road)
  self.assertIn("'-near.json'",road)
  self.assertIn("kind!=='road'",road)
  self.assertIn("radius<3500",road)
  self.assertIn("this.quality==='low'?2:this.quality==='high'?5:3",road)
  self.assertIn("mesh.dispose()",road)
  self.assertNotIn("diffuseTexture",road)
  self.assertIn("this.baseMaterial.emissiveColor",road)
  self.assertIn("this.nearMaterial.emissiveColor",road)

 def test_active_render_uses_road_layer_and_selectable_meshes(self):
  entry=text("src/main.ts")
  self.assertIn("new MetroRoads(scene",entry)
  self.assertIn("roads.init()",entry)
  self.assertIn("roads.update(",entry)
  self.assertIn("roads.setQuality(level)",entry)
  self.assertIn("mesh.name.startsWith('routes-metropole-proches-')",entry)
  self.assertIn("resolution.configure(level)",entry)
  self.assertIn("resolution.update(now,engine.getFps(),camera.isMoving)",entry)
  self.assertIn("const STABLE_RENDER=true",entry)

 def test_mobile_scaler_keeps_quality_bounds_and_hysteresis(self):
  scaler=text("src/adaptiveResolution.ts")
  self.assertIn("medium:{base:1.30,max:1.65}",scaler)
  self.assertIn("this.lowCount>=3",scaler)
  self.assertIn("this.highCount>=5",scaler)
  self.assertIn("PROTOTYPE 0.25",text("index.html"))

if __name__=="__main__":unittest.main()
