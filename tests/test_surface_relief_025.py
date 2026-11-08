"""Les polygones officiels n'utilisent plus des triangles kilométriques."""
from pathlib import Path
import json
import unittest
ROOT=Path(__file__).resolve().parents[1]
def read(p):return (ROOT/p).read_text(encoding='utf-8')
class SurfaceDraping(unittest.TestCase):
 def test_shared_midpoint_topology_and_strict_bounds(self):
  s=read('src/reliefSurface.ts')
  self.assertIn('const need=new Set<number>()',s)
  self.assertIn('const mids=new Map<number,number>()',s)
  self.assertIn('verts.length/2+need.size>limit',s)
  self.assertIn('sample(x,z)+elevation',s)
  self.assertIn('case 7:add(a,ab!,ca!)',s)
 def test_draping_used_everywhere(self):
  for p in ['src/stableWater.ts','src/metroRoads.ts',
   'src/infrastructure.ts','src/surfaceLayer.ts']:
   self.assertIn('appendDraped',read(p),p)
  self.assertIn("appendDraped({positions,indices},coords,faces",read('src/stableWater.ts'))
  self.assertIn('terrainHeight,.58,105,26000',read('src/stableWater.ts'))
 def test_avoid_near_far_z_fighting(self):
  r=read('src/metroRoads.ts')
  self.assertIn('appendRoad(batch,polygon,.42)',r)
  self.assertIn('appendRoad(batch,record[1],.74)',r)
  self.assertIn('this.nearMaterial.zOffset=-3',r)
  self.assertIn('material.zOffset=-4',read('src/infrastructure.ts'))
 def test_terrain_sample_has_no_allocation(self):
  t=read('src/terrain.ts')
  self.assertNotIn('const p=[',t)
  self.assertIn('const p0=this.values[i],p1=this.values[i+1]',t)
 def test_budget_and_version_gate(self):
  self.assertEqual(json.loads(read('package.json'))['version'],'0.26.1')
  self.assertIn('PROTOTYPE 0.26',read('index.html'))
  self.assertNotIn('PROTOTYPE 0.27',read('index.html'))
if __name__=='__main__':unittest.main()
