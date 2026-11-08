"""Contrats du relief IGN et des espaces verts officiels en version 0.25."""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
def src(p):return (ROOT/p).read_text(encoding="utf8")
class NatureIntegration(unittest.TestCase):
 def test_terrain_initializes_before_geographic_layers(self):
  main=src('src/main.ts')
  self.assertLess(main.index('await terrain.init(ground)'),main.index('await Promise.allSettled(['))
  self.assertIn('else camera.camera.target.y=',main)
  self.assertIn('terrainHeight(camera.camera.target.x,camera.camera.target.z)',main)
  self.assertIn('camera.restoreView(restoredView)',main)
  self.assertIn('flatFallback.position.y=-30',src('src/terrain.ts'))
  self.assertIn('mat.diffuseColor=new Color3(.78,.79,.77)',src('src/terrain.ts'))
  self.assertIn('terrainHeight(x,z)+h/2',src('src/metroOverview.ts'))
  self.assertIn('terrainHeight(x,z)+height+.035',src('src/metroOverview.ts'))
 def test_green_water_and_trees_wired(self):
  main=src('src/main.ts')
  self.assertIn("installSurfaceLayer(scene,'data/metropole/surfaces/green.json'",main)
  self.assertIn('water.init()',main)
  self.assertIn('trees.init()',main)
  self.assertIn('metroTrees.init()',main)
  self.assertIn('metroTrees.update(',main)
  self.assertIn('trees.update(',main)
  self.assertNotIn('Arbres 3D en pause',main)
 def test_no_fake_vegetation_and_mobile_budget(self):
  trees=src('src/metroTrees.ts')
  self.assertIn("this.budget=level==='low'?2:level==='high'?6:4",trees)
  self.assertIn('if(isMoving)break',trees)
  self.assertIn('if(!this.wanted.has(tile.id))return',trees)
  self.assertIn('radius>3800',trees)
  self.assertIn('radius<3200',trees)
  self.assertIn('appendDraped',src('src/surfaceLayer.ts'))
  self.assertIn('terrainHeight',src('src/surfaceLayer.ts'))
  self.assertIn('terrainHeight',src('src/bridges.ts'))
 def test_street_camera_uses_real_altitude(self):
  cam=src('src/mobileCamera.ts')
  self.assertIn('terrainHeight(this.camera.target.x,this.camera.target.z)+2.5',cam)
  self.assertIn('terrainHeight(x,z)+bounded*Math.cos(.83)',cam)
if __name__=='__main__':unittest.main()
