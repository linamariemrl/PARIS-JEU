import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class LidarRoofContract(unittest.TestCase):
 def test_requires_measurements(self):
  s=(ROOT/'scripts/prepare_lidar_roofs_4e.py').read_text(encoding='utf8')
  for x in ('url','rasterio.open','sample(','triangulate(','statistics.median',
            'abs(np.percentile','MIN_MATCH'):
   self.assertIn(x,s)
  self.assertNotIn('random.',s)
  self.assertIn('Licence Ouverte 2.0',s)
