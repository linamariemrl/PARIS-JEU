"""L'application active n'affiche ni ne distribue les photographies historiques."""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
class MonochromeInvariants(unittest.TestCase):
    def test_entrypoint_has_no_photography_or_dynamic_sky(self):
        s=(ROOT/"src/main.ts").read_text(encoding="utf8")
        self.assertNotIn("new AerialLayer",s)
        self.assertNotIn("new SkyAndSun",s)
        self.assertNotIn("installNightWindows",s)
        self.assertIn("new TreeLayer",s)
        self.assertIn("trees.init()",s)
        self.assertIn("new GameClock",s)
        self.assertIn("loadInfrastructure",s)
        self.assertIn("setOrbitMode",s)
    def test_buildings_have_no_facade_textures(self):
        s=(ROOT/"src/buildings.ts").read_text(encoding="utf8")
        self.assertNotIn("createFacadeTextures",s)
        self.assertNotIn("diffuseTexture",s)
        self.assertIn("createTile",s)
        self.assertIn("b.volumes",s)
        self.assertNotIn("corniceSegments",s)
    def test_aerials_absent_from_built_site(self):
        s=(ROOT/"package.json").read_text(encoding="utf8")
        self.assertIn("strip_aerial_dist.py dist",s)
        v=(ROOT/"vite.config.ts").read_text(encoding="utf8")
        self.assertIn("'**/data/4e/aerial/**'",v)
        self.assertIn("'**/data/metropole/buildings/tiles/**'",v)
