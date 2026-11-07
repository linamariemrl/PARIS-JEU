"""Contrôles sur les invariants du prototype 0.4."""
from pathlib import Path
import json
import unittest

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"public/data/4e"

class SceneInvariants(unittest.TestCase):
    def test_manifest_declare_all_buildings(self):
        manifest=json.loads((DATA/"manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(sum(tile["count"] for tile in manifest["tiles"]),
                         manifest["buildings"])
        self.assertGreaterEqual(manifest["buildings"],2000)

    def test_zoom_does_not_unload_buildings(self):
        code=(ROOT/"src/tileManager.ts").read_text(encoding="utf-8")
        self.assertIn("await Promise.all([worker(), worker(), worker()])",code)
        self.assertIn("setQuality(_quality:",code)
        self.assertIn("update(_x:",code)
        self.assertNotIn("loaded.meshes.forEach(mesh => mesh.dispose())",code)
        self.assertNotIn("const radius = this.quality",code)

    def test_all_official_street_names_have_label(self):
        file=DATA/"street-names.json"
        if not file.exists():
            self.skipTest("Génération des voies officielles non encore effectuée")
        data=json.loads(file.read_text(encoding="utf-8"))
        self.assertEqual(data["officialCount"],data["namedStreets"])
        self.assertEqual(data["namedStreets"],len(data["labels"]))
        self.assertEqual(len({x["id"] for x in data["labels"]}),len(data["labels"]))
        self.assertGreaterEqual(data["namedStreets"],150)

if __name__=="__main__":
    unittest.main()
