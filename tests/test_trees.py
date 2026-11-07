"""Contrôles hors ligne des arbres officiels de Paris."""
import importlib.util
from pathlib import Path
import unittest

FILE = Path(__file__).resolve().parents[1] / "scripts" / "prepare_trees.py"
spec = importlib.util.spec_from_file_location("prepare_trees", FILE)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class TreesTests(unittest.TestCase):
    def test_tree_position_and_real_height(self):
        row = {
            "idbase": 123, "arrondissement": "PARIS 4E ARRDT",
            "geo_point_2d": {"lon": 2.354, "lat": 48.855},
            "hauteurenm": 14, "genre": "Platanus", "domanialite": "Alignement"
        }
        t = mod.extract_tree(row)
        self.assertEqual(t["h"], 14)
        self.assertFalse(t["estimated"])
        self.assertGreater(t["x"], 0)
        self.assertGreater(t["z"], 0)

    def test_missing_height_is_marked(self):
        t = mod.extract_tree({
            "idbase": 456, "arrondissement": "PARIS 4E ARRDT",
            "geo_point_2d": {"lon": 2.354, "lat": 48.855},
        })
        self.assertEqual(t["h"], 8)
        self.assertTrue(t["estimated"])

    def test_other_arrondissement_or_missing_coordinates_rejected(self):
        self.assertIsNone(mod.extract_tree({
            "idbase": 7, "arrondissement": "PARIS 3E ARRDT",
            "geo_point_2d": {"lon": 2.354, "lat": 48.855}
        }))
        self.assertIsNone(mod.extract_tree({
            "idbase": 8, "arrondissement": "PARIS 4E ARRDT",
        }))

    def test_duplicates_removed(self):
        entry = {
            "idbase": 10, "arrondissement": "PARIS 4E ARRDT",
            "geo_point_2d": {"lon": 2.355, "lat": 48.855}
        }
        self.assertEqual(len(mod.extract([entry, entry])), 1)

if __name__ == "__main__":
    unittest.main()
