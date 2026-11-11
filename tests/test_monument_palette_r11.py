"""R11 : couleur patrimoniale unique et priorité aux preuves photographiques."""
import re
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT/path).read_text(encoding="utf8")


class MonumentsBeigeR11(unittest.TestCase):
    def test_palette_is_a_single_exact_beige(self):
        palette=read("src/monumentPalette.ts")
        self.assertIn("MONUMENT_BEIGE_HEX='#ded0b9'",palette)
        self.assertIn("MONUMENT_BEIGE_RGB=[222/255,208/255,185/255]",palette)
        buildings=read("src/buildings.ts")
        self.assertIn("import {MONUMENT_BEIGE_RGB}",buildings)
        self.assertIn("heritageWall.diffuseColor=new Color3(br,bg,bb)",buildings)
        self.assertIn("heritageRoof.diffuseColor=new Color3(br,bg,bb)",buildings)
        for legacy in ("heritageWall.diffuseColor=new Color3(.87,.80,.69)",
                       "heritageRoof.diffuseColor=new Color3(.78,.71,.62)",
                       "politicalWall","culturalWall","financialWall"):
            self.assertNotIn(legacy,buildings)

    def test_the_beige_is_inherited_by_panorama_and_near_view(self):
        overview=read("src/metroOverview.ts")
        self.assertIn("MONUMENT_BEIGE_RGB",overview)
        self.assertIn("MAJOR_WALL=[beigeR/.90,beigeG/.90,beigeB/.90,1]",overview)
        self.assertIn("MAJOR_ROOF=[beigeR/.76,beigeG/.76,beigeB/.76,1]",overview)
        self.assertIn("roof=beige.clone()",overview)
        browser=read("src/landmarkBrowser.ts")
        self.assertIn("MONUMENT_BEIGE_HEX",browser)
        self.assertNotIn("const MAJOR_BEIGE='#",browser)
        atlas=read("src/heritageAtlas.ts")
        self.assertIn("mesh.color=new Color3(...MONUMENT_BEIGE_RGB)",atlas)

    def test_architecture_requires_real_multiview_sources(self):
        contract=read("docs/DECISION_ARCHITECTURE_MULTIVUES_R11.md")
        for token in ("COLMAP", "Panoramax", "Wikimedia Commons", "Archives de Paris",
                      "photogrammétrie", "EPSG:2154", "#DED0B9",
                      "sans accord explicite"):
            self.assertIn(token,contract)
        for path in ("docs/CONSIGNE_OUTIL_ENRICHISSEMENT.md",
                     "docs/TRANSMISSION_OUTIL_CHATGPT.md"):
            self.assertIn("DECISION_ARCHITECTURE_MULTIVUES_R11.md",read(path))


if __name__=="__main__":
    unittest.main()
