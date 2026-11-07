import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class MetroStreaming(unittest.TestCase):
 def test_loads_only_verified_index(self):
  c=(ROOT/'src/metroTiles.ts').read_text()
  self.assertIn("manifest.totalBuildings<15000",c)
  self.assertIn("this.inFlight.size>=2",c)
  self.assertIn("mesh.dispose()",c)
  self.assertIn("data.schema!==2",c)
 def test_offline_cache_is_bounded(self):
  c=(ROOT/'vite.config.ts').read_text()
  self.assertIn("maxEntries: 28",c)
  self.assertIn("metropole/buildings/tiles",c)
