"""Régression v0.25.2 : couverture 3D légère autour de Paris sans coût GPU non borné."""
from pathlib import Path
import json
import math
import unittest

ROOT=Path(__file__).resolve().parents[1]
def read(path):
 return (ROOT/path).read_text(encoding="utf8")

class PanoramicCoverage(unittest.TestCase):
 def test_sampled_roofs_and_detailed_substitution(self):
  lod=read("src/metroOverview.ts")
  self.assertIn("const SAMPLED_ROOFS_PER_GROUP=2400",lod)
  self.assertIn("const displayGroups=this.roofsOnly?maxGroups+8:maxGroups",lod)
  self.assertIn("this.roofsOnly?roofCount(group.count):group.count",lod)
  self.assertIn("const sampledIndices=new Uint32Array(sampleSize)",lod)
  self.assertIn("roof.thinInstanceSetBuffer('matrix',sampledRoofBuffer,16,false)",lod)
  self.assertIn("state.sampledRoofBuffer.set(",lod)
  self.assertIn("state.roof.thinInstanceBufferUpdated('matrix')",lod)
  self.assertIn("const maxInstances=this.roofsOnly?36000:16000",lod)
  self.assertNotIn("diffuseTexture",lod)

 def test_center_of_paris_has_more_neighborhoods_at_same_gpu_budget(self):
  source=json.loads(read("public/data/metropole/buildings/manifest.json"))
  groups={}
  for t in source["tiles"]:
   key=(t["ix"]//4,t["iz"]//4)
   groups[key]=groups.get(key,0)+t["count"]
  x=z=0
  radius=4500
  limit=max(2500,min(16000,radius*1.35))+1800
  candidates=sorted(((gx,gz,count) for (gx,gz),count in groups.items()
   if math.hypot((gx+.5)*3200-x,(gz+.5)*3200-z)<limit),
   key=lambda g: math.hypot((g[0]+.5)*3200-x,(g[1]+.5)*3200-z))
  old=[];old_cost=0
  new=[];new_cost=0
  for gx,gz,count in candidates:
   if len(old)<7 and (not old or old_cost+count<=36000):
    old.append((gx,gz));old_cost+=count
   cost=math.ceil(count/max(1,math.ceil(count/2400)))
   if len(new)<15 and (not new or new_cost+cost<=36000):
    new.append((gx,gz));new_cost+=cost
  self.assertGreaterEqual(len(candidates),15)
  self.assertLessEqual(len(old),3)
  self.assertGreaterEqual(len(new),12)
  self.assertLessEqual(new_cost,36000)

if __name__=="__main__":unittest.main()
