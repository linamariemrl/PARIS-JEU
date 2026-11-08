"""Régression de la palette neutre Android (le sol ne doit plus devenir noir)."""
import re
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]

def read(path):
    return (ROOT/path).read_text(encoding="utf8")

class UnlitPalette(unittest.TestCase):
    def test_ground_has_real_emission(self):
        main=read("src/main.ts")
        self.assertIn("mat.disableLighting=true", main)
        self.assertIn("mat.emissiveColor=new Color3(.81,.81,.80)",main)
        self.assertNotIn("mat.emissiveColor=new Color3(.06",main)

    def test_neutral_infrastructure_uses_palette_for_emission(self):
        infra=read("src/infrastructure.ts")
        self.assertIn("material.disableLighting=true",infra)
        self.assertIn("material.emissiveColor=new Color3(r,g,b)",infra)
        self.assertNotIn("material.emissiveColor=new Color3(.025",infra)
        self.assertIn("road: [.70,.71,.71]",infra)

    def test_real_water_is_not_black(self):
        water=read("src/stableWater.ts")
        self.assertIn("mat.emissiveColor=new Color3(.73,.74,.75)",water)
        self.assertNotIn("mat.emissiveColor=new Color3(.03",water)

    def test_roof_lod_visible_without_dynamic_light(self):
        overview=read("src/metroOverview.ts")
        self.assertIn("this.roofMaterial.disableLighting=true",overview)
        self.assertIn("this.roofMaterial.emissiveColor=new Color3(.76,.76,.76)",overview)
        self.assertIn("const maxInstances=this.roofsOnly?36000:16000",overview)

    def test_experimental_surfaces_cannot_reintroduce_black(self):
        layer=read("src/surfaceLayer.ts")
        tiles=read("src/surfaceTiles.ts")
        self.assertIn("mat.emissiveColor=new Color3(...palette[kind])",layer)
        self.assertIn("mat.emissiveColor=new Color3(...RGB[kind]);",tiles)
        self.assertNotIn("mat.emissiveColor=new Color3(...RGB[kind]).scale(.17)",tiles)

    def test_several_materials_remain_neutral(self):
        infra=read("src/infrastructure.ts")
        match=re.search(r"const COLORS.*?=\s*\{(.*?)\};",infra,re.S)
        self.assertIsNotNone(match)
        for rgb in re.findall(r"\[([^\]]+)\]",match.group(1)):
            values=[float(x.strip()) for x in rgb.split(",")]
            self.assertEqual(len(values),3)
            self.assertLessEqual(max(values)-min(values),.035)
            self.assertGreaterEqual(min(values),.69)
            self.assertLessEqual(max(values),.86)

if __name__=="__main__":
    unittest.main()
