"""Invariants géographiques de la maquette colorée : aucun objet inventé."""
import json
import math
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SURF=ROOT/"public/data/metropole/surfaces"
TREE=ROOT/"public/data/metropole/trees"

class NaturalTerritory(unittest.TestCase):
    def test_official_surfaces_and_semantics(self):
        for name,minimum,kinds in [
            ("green",80,{"managed","wood","planted"}),
            ("water",12,{"water"}),
            ("roads",10000,{"road"}),
        ]:
            with self.subTest(name=name):
                path=SURF/(name+".json")
                if not path.exists():
                    self.skipTest("Extraction "+name+" non encore publiée")
                data=json.loads(path.read_text(encoding="utf-8"))
                self.assertEqual(data["schema"],1)
                self.assertEqual(data["count"],len(data["features"]))
                self.assertGreaterEqual(data["count"],minimum)
                self.assertTrue(data["sourceUrl"].startswith("https://"))
                self.assertTrue(set(x["kind"] for x in data["features"]).issubset(kinds))
                for feature in data["features"]:
                    self.assertGreater(len(feature["polygons"]),0)
                    for polygon in feature["polygons"]:
                        self.assertGreater(len(polygon[0]),3)
                        for x,z in polygon[0]:
                            self.assertTrue(math.isfinite(x) and math.isfinite(z))
                            self.assertLess(abs(x),25000)
                            self.assertLess(abs(z),25000)

    def test_tree_manifest_is_complete_and_deduplicated_from_pilot(self):
        index=TREE/"manifest.json"
        if not index.exists():
            self.skipTest("Arbres des autres arrondissements en préparation")
        data=json.loads(index.read_text(encoding="utf-8"))
        pilot=json.loads((ROOT/"public/data/4e/trees.json").read_text(encoding="utf-8"))
        self.assertEqual(data["schema"],1)
        self.assertEqual(data["recordBytes"],7)
        self.assertGreaterEqual(data["count"],50000)
        self.assertEqual(data["excludedPilotTrees"],len(pilot["trees"]))
        self.assertEqual(sum(t["count"] for t in data["tiles"]),data["count"])
        for tile in data["tiles"]:
            self.assertEqual((TREE/(tile["id"]+".bin")).stat().st_size,
                             tile["count"]*7)

    def test_video_textures_and_fictive_trees_absent(self):
        main=(ROOT/"src/main.ts").read_text(encoding="utf-8")
        tree=(ROOT/"src/metroTrees.ts").read_text(encoding="utf-8")
        surface=(ROOT/"src/surfaceLayer.ts").read_text(encoding="utf-8")
        self.assertIn("new TreeLayer",main)
        self.assertIn("new MetroTreeLayer",main)
        self.assertIn("new SurfaceTileManager",main)
        self.assertIn("thinInstanceSetBuffer",tree)
        self.assertIn("requestAnimationFrame",surface)
        self.assertNotIn("diffuseTexture",tree)
        self.assertNotIn("diffuseTexture",surface)

if __name__=="__main__":
    unittest.main()
