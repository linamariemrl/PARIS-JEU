"""Tests hors ligne de la préparation de la voirie OpenStreetMap."""
import importlib.util
from pathlib import Path
import unittest

from shapely.geometry import box

FILE = Path(__file__).resolve().parents[1] / "scripts" / "prepare_infrastructure.py"
spec = importlib.util.spec_from_file_location("prepare_infrastructure", FILE)
infra = importlib.util.module_from_spec(spec)
spec.loader.exec_module(infra)

def item(number, highway, points, **tags):
    return {
        "type": "way", "id": number,
        "tags": {"highway": highway, **tags},
        "geometry": [{"lon": lon, "lat": lat} for lon, lat in points],
    }

class PreparingInfrastructure(unittest.TestCase):
    def test_widths_are_bounded_and_marked(self):
        self.assertEqual(infra.width_of({"width": "7.5"}, "residential"), 7.5)
        self.assertEqual(infra.width_of({"width": "300"}, "residential"), 6)
        self.assertEqual(infra.width_of({"lanes": "3"}, "residential"), 9)

    def test_query_has_bbox_and_street_and_water(self):
        q = infra.query_for((2.35, 48.85, 2.37, 48.87))
        self.assertIn('way["highway"]', q)
        self.assertIn('way["natural"="water"]', q)
        self.assertIn("48.850000,2.350000,48.870000,2.370000", q)

    def test_layers_preserve_bridge_and_river(self):
        elements = []
        for i in range(86):
            lon = infra.CX - 0.003 + 0.00006 * i
            elements.append(item(i, "residential", [(lon, infra.CZ - 0.0007),
                                                     (lon, infra.CZ + 0.0007)]))
        for i in range(2):
            lat = infra.CZ + 0.00013 * i
            elements.append(item(200 + i, "primary", [(infra.CX - 0.0008, lat),
                                                       (infra.CX + 0.0008, lat)], bridge="yes"))
        elements.append({
            "type": "way", "id": 300, "tags": {"natural": "water", "water": "river"},
            "geometry": [
                {"lon": infra.CX - 0.001, "lat": infra.CZ - 0.00018},
                {"lon": infra.CX + 0.001, "lat": infra.CZ - 0.00018},
                {"lon": infra.CX + 0.001, "lat": infra.CZ + 0.00018},
                {"lon": infra.CX - 0.001, "lat": infra.CZ + 0.00018},
                {"lon": infra.CX - 0.001, "lat": infra.CZ - 0.00018},
            ],
        })
        layers, bridges, counts, approximate = infra.collect(
            elements, box(-700, -500, 700, 500))
        self.assertFalse(approximate)
        self.assertEqual(counts["bridges"], 2)
        self.assertTrue(layers["road"])
        self.assertTrue(layers["sidewalk"])
        self.assertTrue(layers["bridge"])
        self.assertTrue(layers["water"])
        self.assertTrue(layers["bank"])
        self.assertEqual(len(bridges), 2)

if __name__ == "__main__":
    unittest.main()
