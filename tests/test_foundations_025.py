"""Vérification anti-pointes du MNT et des géométries des ponts."""
from pathlib import Path
import json
import unittest
ROOT=Path(__file__).resolve().parents[1]
def src(p):return (ROOT/p).read_text(encoding='utf8')

class FoundationGeometry(unittest.TestCase):
 def test_building_roofs_no_longer_follow_per_vertex_terrain(self):
  code=src('src/buildings.ts')
  self.assertIn('const foundation=stableFoundation(rings[0],terrainHeight)',code)
  self.assertIn('const topP=foundation+ph,topQ=foundation+qh',code)
  self.assertIn('Math.min(terrainHeight(p.x,p.z),topP-.35)',code)
  self.assertIn('foundation+a[2]',code)
  self.assertIn('foundation+top(a)',code)
  self.assertNotIn('terrainHeight(a.x,a.z)+top(a)',code)
 def test_bridge_decks_cannot_twist_on_bank_relief(self):
  code=src('src/bridges.ts')
  self.assertIn('deck.referenceY=reference',code)
  self.assertIn('parapets.referenceY=reference',code)
  self.assertIn('p[1]+this.referenceY',code)
  self.assertNotIn('p[1]+terrainHeight(p[0],p[2])',code)
 def test_terrain_is_legible_without_new_triangles(self):
  code=src('src/terrain.ts')
  self.assertIn('vd.colors=colors',code)
  self.assertIn('mesh.useVertexColors=true',code)
  self.assertIn('const shade=.93-.20*t',code)
  self.assertIn('indices.push(a,c,b,b,c,d)',code)
 def test_no_major_revision_and_nature_remains(self):
  self.assertEqual(json.loads(src('package.json'))['version'],'0.25.8')
  main=src('src/main.ts')
  for item in ['roads.init()','water.init()','trees.init()','metroTrees.init()',
               "installSurfaceLayer(scene,'data/metropole/surfaces/green.json'"]:
   self.assertIn(item,main)
  self.assertIn('const STABLE_RENDER=true',main)
  self.assertIn('PROTOTYPE 0.25',src('index.html'))

if __name__=='__main__':unittest.main()
