from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
class LidarIndexContract(unittest.TestCase):
 def test_sources_and_no_fabrication(self):
  s=(ROOT/'scripts/inspect_lidar_4e.py').read_text()
  self.assertIn("IGNF_LIDAR-HD_METADONNEE:metadata",s)
  self.assertIn("url_mnh",s)
  self.assertNotIn("np.random",s)
  self.assertIn('status',s)
