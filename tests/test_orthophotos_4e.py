import importlib.util
import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
path=ROOT/"scripts/prepare_orthophotos_4e.py"
spec=importlib.util.spec_from_file_location("orthophotos",path)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class OrthoIGN(unittest.TestCase):
    def test_bounding_box_uses_actual_paris_boundary(self):
        a,b,c,d=module.get_coverage()
        self.assertGreaterEqual(c-a,5)
        self.assertGreaterEqual(d-b,5)
        self.assertLessEqual((c-a)*(d-b),130)

    def test_inverse_projection_stable(self):
        lon,lat=module.xy_to_ll(320,-220)
        x=(lon-module.CENTER_LON)*module.METERS_X
        z=(lat-module.CENTER_LAT)*module.METERS_Z
        self.assertAlmostEqual(x,320,places=6)
        self.assertAlmostEqual(z,-220,places=6)

    def test_wms_url_uses_aerial_source_not_sketch(self):
        url=module.wms_url(-300,-300,0,0)
        self.assertIn("data.geopf.fr",url)
        self.assertIn("ORTHOIMAGERY.ORTHOPHOTOS",url)
        self.assertIn("GetMap",url)

    def test_generated_aerial_data_if_present(self):
        file=ROOT/"public/data/4e/aerial/manifest.json"
        if not file.exists():
            self.skipTest("Photographies IGN non téléchargées")
        d=json.loads(file.read_text(encoding="utf-8"))
        self.assertEqual(d["schema"],1)
        self.assertEqual(d["tileMeters"],300)
        self.assertGreater(len(d["tiles"]),25)
        self.assertGreater(d["totalBytes"],500000)
        self.assertEqual(len(d["tiles"]),len({
            (t["ix"],t["iz"]) for t in d["tiles"]
        }))
        for t in d["tiles"]:
            path=file.parent/t["file"]
            self.assertTrue(path.is_file(),str(path))
            self.assertGreater(path.stat().st_size,10000)
