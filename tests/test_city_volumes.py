import unittest,importlib.util
from pathlib import Path
from shapely.geometry import Polygon
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("volumes",ROOT/"scripts/prepare_city_volumes.py")
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)
class BuildingVolumes(unittest.TestCase):
    def test_floor_counts_are_not_absolute_height(self):
        self.assertEqual(mod.floors_of({"nb_pl":5.0,"h_et_max":4}),5)
        self.assertEqual(mod.floors_of({"nb_pl":None,"h_et_max":3}),4)
        self.assertIsNone(mod.floors_of({"nb_pl":None,"h_et_max":None}))
    def test_rings_preserve_real_coordinates(self):
        ring=Polygon([(0,0),(12,0),(12,7),(0,7),(0,0)])
        coords=mod.rings(ring)
        self.assertEqual(len(coords),1)
        self.assertEqual(coords[0][0][0],[0,0])
    def test_ign_reference_untouched(self):
        buildings=mod.original_buildings()
        self.assertEqual(len(buildings),2696)
        self.assertTrue(all(b.area>0 for b in buildings.values()))
