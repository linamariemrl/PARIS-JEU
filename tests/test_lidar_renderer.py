from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
class LidarRendererTest(unittest.TestCase):
 def test_renderer_uses_measured_points(self):
  code=(ROOT/'src/buildings.ts').read_text()
  self.assertIn('validLidarPart',code)
  self.assertIn('lidar.indices',code)
  self.assertIn('lidar.ringsHeights',code)
  self.assertIn('localCoordinates',code)
  self.assertNotIn('new AerialLayer',code)
 def test_overlay_is_optional(self):
  code=(ROOT/'src/tileManager.ts').read_text()
  self.assertIn("roof-lidar.json",code)
  self.assertIn('if(lidar)building.lidarRoof=lidar',code)
