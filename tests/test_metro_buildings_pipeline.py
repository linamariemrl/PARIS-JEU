import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class MetroBuildingContract(unittest.TestCase):
 def test_no_fictional_footprints(self):
  s=(ROOT/'scripts/prepare_metropole_buildings.py').read_text()
  self.assertIn("BDTOPO_V3:batiment",s)
  self.assertIn("area=get_perimeter()",s)
  self.assertIn("estimatedHeight",s)
  self.assertIn("MAX_DISTRIBUTION",s)
  self.assertNotIn("np.random",s)
