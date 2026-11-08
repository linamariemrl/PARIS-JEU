"""Récupération rapide des secteurs de voirie tout en gardant le GPU borné."""
import unittest
from pathlib import Path
import json
ROOT=Path(__file__).resolve().parents[1]
def read(p):return (ROOT/p).read_text(encoding='utf-8')

class RoadsCache(unittest.TestCase):
 def test_cpu_memory_cache_is_lru_and_strict(self):
  roads=read('src/metroRoads.ts')
  self.assertIn("private nearCache=new Map<string,Batch>()",roads)
  self.assertIn("this.nearCache.size>=6",roads)
  self.assertIn("this.cachedVertices+vertices>180000",roads)
  self.assertIn("this.nearCache.delete(oldest)",roads)
  self.assertIn("const previous=this.nearCache.get(id)",roads)
  self.assertIn("this.keepNear(tile.id,batch)",roads)
  self.assertIn("let batch=this.nearCache.get(tile.id)",roads)
 def test_stop_unneeded_geo_processing_on_a_gesture(self):
  roads=read('src/metroRoads.ts')
  self.assertIn("if(!this.wanted.has(tile.id))return",roads)
  self.assertIn("if(i>0&&i%48===0)",roads)
  self.assertIn("if(!moving&&this.fetching.size===0)",roads)
  self.assertIn("mesh.dispose()",roads)
 def test_0_26_still_locked(self):
  self.assertEqual(json.loads(read('package.json'))['version'],'0.26.2')
  self.assertIn("PROTOTYPE 0.26",read("index.html"))
if __name__=='__main__':unittest.main()
