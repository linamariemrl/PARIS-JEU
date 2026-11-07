"""Tests hors ligne du traitement des géométries IGN."""
import importlib.util
import unittest
from pathlib import Path
from shapely.geometry import box, mapping

FILE = Path(__file__).resolve().parents[1] / 'scripts' / 'prepare_4e.py'
spec = importlib.util.spec_from_file_location('prepare_4e', FILE)
prepare = importlib.util.module_from_spec(spec)
spec.loader.exec_module(prepare)

class PreparingBuildings(unittest.TestCase):
    def test_real_height_is_preserved(self):
        area = box(2.35, 48.85, 2.36, 48.86)
        footprint = box(2.353, 48.854, 2.3531, 48.8541)
        raw = {'id':'sample', 'properties':{'cleabs':'sample', 'hauteur':19, 'usage_1':'Résidentiel'}, 'geometry':mapping(footprint)}
        rep = footprint.representative_point()
        x, z = prepare.ll_to_xy(rep.x, rep.y)
        b = prepare.clean_feature(raw, area, int(x // prepare.TILE_METERS), int(z // prepare.TILE_METERS))
        self.assertIsNotNone(b)
        self.assertEqual(b['id'], 'sample')
        self.assertEqual(b['height'], 19)
        self.assertFalse(b['estimatedHeight'])
        self.assertTrue(b['polygons'])

    def test_height_absence_is_marked(self):
        area = box(2.35, 48.85, 2.36, 48.86)
        footprint = box(2.353, 48.854, 2.3531, 48.8541)
        raw = {'id':'sample2', 'properties':{'cleabs':'sample2'}, 'geometry':mapping(footprint)}
        rep = footprint.representative_point()
        x, z = prepare.ll_to_xy(rep.x, rep.y)
        b = prepare.clean_feature(raw, area, int(x // prepare.TILE_METERS), int(z // prepare.TILE_METERS))
        self.assertTrue(b['estimatedHeight'])
        self.assertEqual(b['height'], 15)
if __name__ == '__main__':
    unittest.main()
