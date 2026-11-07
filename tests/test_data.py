"""Validation des données générées, jamais exécutée sans le téléchargement IGN."""
import json
import unittest
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1] / 'public' / 'data' / '4e'

class GeneratedData(unittest.TestCase):
    def test_manifest_and_tiles(self):
        manifest_path = ROOT / 'manifest.json'
        self.assertTrue(manifest_path.is_file(), 'Données IGN absentes')
        manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
        self.assertEqual(manifest['schema'], 1)
        self.assertGreaterEqual(len(manifest['tiles']), 4)
        ids = set()
        total = 0
        for t in manifest['tiles']:
            name = ROOT / 'tiles' / (t['id'] + '.json')
            self.assertTrue(name.is_file(), str(name))
            data = json.loads(name.read_text(encoding='utf-8'))
            self.assertEqual(len(data['buildings']), t['count'])
            for b in data['buildings']:
                self.assertNotIn(b['id'], ids)
                self.assertGreater(b['height'], 0)
                self.assertTrue(b['polygons'])
                ids.add(b['id'])
                total += 1
        self.assertEqual(total, manifest['buildings'])
        self.assertGreater(total, 100)
if __name__ == '__main__':
    unittest.main()
