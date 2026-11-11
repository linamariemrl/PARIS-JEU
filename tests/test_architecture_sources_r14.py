"""R14 : corpus ouvert et interdiction de certifier un batiment sur de simples photos."""
import copy
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from review_architecture_sources_r14 import review

EVIDENCE = ROOT / "public/data/metropole/architecture/evidence/PA00086319-open-views-r14.json"
REGISTRATION = ROOT / "public/data/metropole/architecture/registration/PA00086319.json"
INDEX = ROOT / "public/data/metropole/architecture/models/index.json"


class ReviewR14(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.source = json.loads(EVIDENCE.read_text(encoding="utf8"))
        cls.registration = json.loads(REGISTRATION.read_text(encoding="utf8"))
        cls.index = json.loads(INDEX.read_text(encoding="utf8"))

    def check(self, source=None, registration=None, index=None):
        return review(source if source is not None else self.source,
                      registration if registration is not None else self.registration,
                      index if index is not None else self.index)

    def test_verified_corpus_remains_non_reconstructed(self):
        r = self.check()
        self.assertEqual(r["errors"], [], r)
        self.assertEqual(r["status"], "sources-documented-not-triangulated")
        self.assertEqual((r["sourceCount"], r["photoCount"], r["historicalPlanCount"]), (5, 4, 1))
        self.assertEqual(r["publishedCameraPositions"], 2)
        self.assertEqual(r["calibratedCameraPoses"], 0)
        self.assertEqual(r["certifiedSegments"], 0)

    def test_licensed_sources_have_metadata_and_no_image_embedded(self):
        self.assertTrue(all("sourcePage" in row and "author" in row and
                            "license" in row for row in self.source["sources"]))
        self.assertNotIn("imageBytes", self.source)
        self.assertNotIn("base64", EVIDENCE.read_text(encoding="utf8"))

    def test_rejects_closed_license(self):
        data = copy.deepcopy(self.source)
        data["sources"][0]["license"] = "all-rights-reserved"
        self.assertTrue(self.check(source=data)["errors"])

    def test_rejects_google_street_view(self):
        data = copy.deepcopy(self.source)
        data["sources"][1]["sourcePage"] = "https://www.google.com/maps/"
        self.assertTrue(self.check(source=data)["errors"])

    def test_rejects_duplicate_source(self):
        data = copy.deepcopy(self.source)
        data["sources"][1]["id"] = data["sources"][0]["id"]
        self.assertTrue(self.check(source=data)["errors"])

    def test_rejects_fabricated_camera_bearing(self):
        data = copy.deepcopy(self.source)
        data["sources"][1]["cameraBearingDeg"] = 90
        self.assertTrue(self.check(source=data)["errors"])

    def test_rejects_unverified_camera_pose(self):
        data = copy.deepcopy(self.source)
        data["sources"][1]["cameraPoseVerified"] = True
        self.assertTrue(self.check(source=data)["errors"])

    def test_rejects_fabricated_matches(self):
        data = copy.deepcopy(self.source)
        data["sources"][2]["featureMatchesMeasured"] = 4
        self.assertTrue(self.check(source=data)["errors"])

    def test_rejects_camera_outside_paris(self):
        data = copy.deepcopy(self.source)
        data["sources"][1]["cameraPositionWgs84"] = [0.0, 0.0]
        self.assertTrue(self.check(source=data)["errors"])

    def test_rejects_unsubstantiated_registration(self):
        doc = copy.deepcopy(self.registration)
        doc["status"] = "registered"
        self.assertTrue(self.check(registration=doc)["errors"])

    def test_rejects_premature_model_index(self):
        index = copy.deepcopy(self.index)
        index["models"] = [{"ref": self.source["ref"]}]
        self.assertTrue(self.check(index=index)["errors"])

    def test_rejects_claimed_certified_segments(self):
        doc = copy.deepcopy(self.source)
        doc["registration"]["triangulatedSegments"] = 12
        self.assertTrue(self.check(source=doc)["errors"])

    def test_rejects_plan_falsely_described_as_photo(self):
        doc = copy.deepcopy(self.source)
        doc["sources"][0]["kind"] = "current-photograph"
        self.assertTrue(self.check(source=doc)["errors"])

    def test_rejects_unattributed_image(self):
        doc = copy.deepcopy(self.source)
        doc["sources"][2]["author"] = ""
        self.assertTrue(self.check(source=doc)["errors"])


if __name__ == "__main__":
    unittest.main()
