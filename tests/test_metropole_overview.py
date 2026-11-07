"""LOD métropolitain : source IGN, couverture exhaustive et absence d'invention."""
from __future__ import annotations
import json
import struct
import unittest
from pathlib import Path

from scripts.prepare_metropole_overview import record, ROOT, TARGET, SOURCE


class MetroOverviewTests(unittest.TestCase):
    def test_quantized_building_carries_valid_world_dimensions(self):
        building = {
            "id": "IGN_TEST",
            "height": 17.5,
            "polygons": [[[
                [800.0, 800.0],
                [820.0, 800.0],
                [820.0, 812.0],
                [800.0, 812.0],
                [800.0, 800.0],
            ]]],
        }
        encoded = record(building, 1, 1, 800)
        self.assertEqual(len(encoded), 12)
        x, z, width, depth, height, angle = struct.unpack("<hhHHHh", encoded)
        self.assertEqual((x, z, width, depth, height, angle), (40, 24, 80, 48, 70, 0))

    def test_no_silent_clipping_of_invalid_coordinates(self):
        bad = {
            "id": "out-of-range",
            "height": 15,
            "polygons": [[[[50000., 0.], [50001., 0.],
                           [50001., 1.], [50000., 1.]]]],
        }
        with self.assertRaises(ValueError):
            record(bad, 0, 0, 800)

    def test_generated_files_have_exact_ign_building_count(self):
        name = TARGET / "manifest.json"
        if not name.exists():
            self.skipTest("Les fichiers d'aperçu sont produits lors de la compilation")
        index = json.loads(name.read_text(encoding="utf-8"))
        source = json.loads((SOURCE / "manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(index["totalBuildings"], source["totalBuildings"])
        self.assertEqual(index["geometry"], "oriented-box-approximation")
        self.assertEqual(index["quantizationMeters"], 0.25)
        self.assertEqual(sum(group["count"] for group in index["groups"]),
                         source["totalBuildings"])
        for group in index["groups"]:
            payload = TARGET / (group["id"] + ".bin")
            self.assertEqual(payload.stat().st_size, group["count"] * 12)
            self.assertEqual(sum(t["count"] for t in group["tiles"]),
                             group["count"])
            last = 0
            for tile in group["tiles"]:
                self.assertEqual(tile["offset"], last)
                last += tile["count"]


if __name__ == "__main__":
    unittest.main()
