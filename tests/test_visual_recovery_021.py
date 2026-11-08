"""Régressions v0.23 : couleur des matériaux, eau unique et budget LOD mobile."""
import json
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]

def source(path):
    return (ROOT/path).read_text(encoding="utf-8")

class VisualRecovery(unittest.TestCase):
    def test_contrast_and_official_water_are_stable(self):
        entry=source("src/main.ts")
        infra=source("src/infrastructure.ts")
        water=source("src/stableWater.ts")
        self.assertIn("const STABLE_RENDER=true",entry)
        self.assertIn("new StableWaterLayer",entry)
        self.assertIn("water.init()",entry)
        self.assertIn("mat.disableLighting=true",entry)
        self.assertIn("material.disableLighting=true",infra)
        self.assertIn("mat.disableLighting=true",water)
        self.assertIn("getMeshByName('infrastructure-water')",water)
        self.assertIn("water.setVisible(waterToggle.checked)",entry)
        self.assertIn("terrainHeight",source("src/buildings.ts"))
        self.assertIn("terrainHeight",infra)
        self.assertIn("terrainHeight",source("src/bridges.ts"))

    def test_real_hydrography_is_bounded(self):
        data=json.loads(source("public/data/metropole/surfaces/water.json"))
        self.assertEqual(data["schema"],1)
        self.assertEqual(data["count"],len(data["features"]))
        self.assertGreaterEqual(data["count"],50)
        self.assertLessEqual(data["count"],2000)
        self.assertTrue(data["source"].startswith("IGN"))
        self.assertTrue(all(f["kind"]=="water" for f in data["features"]))

    def test_lod_is_two_triangles_and_never_overlaps_boxes(self):
        lod=source("src/metroOverview.ts")
        self.assertIn("CreateGround('toits-legers-'",lod)
        self.assertIn("setRoofLodEnabled(enabled:boolean)",lod)
        self.assertIn("this.roofLODEnabled&&!isMoving",lod)
        self.assertIn("group.mesh.setEnabled(this.visible.has(id)&&!enabled)",lod)
        self.assertIn("group.roof.setEnabled(this.visible.has(id)&&enabled)",lod)
        self.assertIn("mesh.setEnabled(this.visible.has(group.id)&&!this.roofsOnly)",lod)
        self.assertIn("roof.setEnabled(this.visible.has(group.id)&&this.roofsOnly)",lod)
        self.assertIn("this.writeTile(state.buffer",lod)
        self.assertIn("this.writeRoofTile(state.roofBuffer",lod)
        self.assertNotIn("diffuseTexture",lod)

    def test_gpu_budget_and_grey_floor(self):
        lod=source("src/metroOverview.ts")
        entry=source("src/main.ts")
        self.assertIn("const maxInstances=this.roofsOnly?36000:16000",lod)
        self.assertIn("const maxGroups=this.roofsOnly?7:4",lod)
        self.assertIn("this.trimLoaded(x,z)",lod)
        self.assertIn("ground.position.y=-.5",entry)
        self.assertIn("mat.emissiveColor=new Color3(.81,.81,.80)",entry)
        self.assertNotIn("loadMetropolitanOutlines(scene)",entry)

    def test_mobile_has_independent_fallback_switches(self):
        html=source("index.html")
        entry=source("src/main.ts")
        self.assertIn('id="water-layer-toggle"',html)
        self.assertIn('id="roof-lod-toggle"',html)
        self.assertIn("water.setVisible(waterToggle.checked)",entry)
        self.assertIn("overview.setRoofLodEnabled(lodToggle.checked)",entry)
        self.assertIn("PROTOTYPE 0.25",html)

if __name__=="__main__":
    unittest.main()
