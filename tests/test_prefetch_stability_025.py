"""Règles anti-latence de la branche 0.25 : aucune nouvelle version majeure."""
from pathlib import Path
import json
import unittest

ROOT=Path(__file__).resolve().parents[1]
def src(p):return (ROOT/p).read_text(encoding='utf-8')

class StreamingStability(unittest.TestCase):
 def test_cpu_cache_and_no_unbounded_gpu(self):
  lod=src('src/metroOverview.ts')
  self.assertIn('private rawCache=new Map<string,ArrayBuffer>()',lod)
  self.assertIn('private rawInFlight=new Map<string,Promise<ArrayBuffer>>()',lod)
  self.assertIn('window.setTimeout(()=>void this.prefetchRaw(),1500)',lod)
  self.assertIn('await this.rawOf(group)',lod)
  self.assertIn('if(connection?.saveData)return',lod)
  self.assertIn('while(document.hidden||this.cameraMoving||this.inFlight.size>0)',lod)
  self.assertIn('if(!near.some(g=>this.loaded.has(g.id))&&this.loaded.size)',lod)
  self.assertIn('const maxInstances=this.roofsOnly?36000:16000',lod)
  self.assertIn('const maxGroups=this.roofsOnly?7:4',lod)
  self.assertIn('if(performance.now()-batchStart>7)',lod)
  self.assertIn('if(message===this.lastReported)return',lod)
  self.assertNotIn('this.trimLoaded(this.lastX===Infinity?0',lod)

 def test_no_expensive_exact_loads_during_gesture(self):
  metro=src('src/metroTiles.ts')
  main=src('src/main.ts')
  self.assertIn('update(x:number,z:number,radius:number,isMoving=false)',metro)
  self.assertIn('if(isMoving)break',metro)
  self.assertIn('camera.camera.radius,camera.isMoving);',main)

 def test_major_version_gate(self):
  html=src('index.html')
  pkg=json.loads(src('package.json'))
  self.assertIn('PROTOTYPE 0.25',html)
  self.assertEqual(pkg['version'],'0.25.2')
  self.assertNotIn('PROTOTYPE 0.26',html)

if __name__=='__main__':unittest.main()
