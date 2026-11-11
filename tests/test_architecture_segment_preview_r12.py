"""R12 — première preuve géométrique visuelle issue de cotes d'archive (1878).

Le visualiseur de la XIVe assise doit employer uniquement les longueurs
inscrites, sans inventer altitude, calage en ville, façade ou profondeur.
"""
from __future__ import annotations
import json
import re
import shutil
import subprocess
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ORIGIN = ROOT / "public/data/metropole/architecture/measurements/PA00086319.json"
PROOF = ROOT / "public/data/metropole/architecture/measurements/PA00086319-boccador-assise14-proof.json"
PREVIEW = ROOT / "public/previews/hotel-de-ville-assise1878.html"


class MeasuredSegments1878(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.original = json.loads(ORIGIN.read_text(encoding="utf8"))
        cls.proof = json.loads(PROOF.read_text(encoding="utf8"))
        cls.html = PREVIEW.read_text(encoding="utf8")

    def test_exact_thirty_archival_segments_in_source_order(self):
        src = self.original
        p = self.proof
        self.assertEqual(p["schema"], "paris-architecture-segments/1")
        self.assertEqual(p["ref"], src["ref"])
        self.assertEqual(p["sourceId"], src["sources"][0]["sourceId"])
        self.assertEqual(len(p["segments"]), 30)
        start = 0
        for chain in src["chains"]:
            subtotal = 0
            for original in chain["segments"]:
                rebuilt = p["segments"][start]
                self.assertEqual(rebuilt["chain"], chain["chainId"])
                self.assertEqual(rebuilt["lengthM"], original["value"])
                self.assertEqual(rebuilt["element"], original["element"])
                self.assertEqual(rebuilt["description"], original.get("note", ""))
                start += 1
                subtotal += original["value"]
            self.assertAlmostEqual(subtotal, chain["inscribedTotal"], places=6)
            self.assertEqual(chain["closure"]["status"], "closed")
        self.assertEqual(start, len(p["segments"]))

    def test_metric_chain_closes_without_fabrication(self):
        p = self.proof
        measurements = self.original["measurements"]
        height = [m for m in measurements if m["property"] == "course_height"
                  and m["status"] == "transcribed-legible"]
        self.assertTrue(any(m["value"] == p["courseHeightM"] for m in height))
        self.assertEqual(p["courseHeightM"], 0.42)
        self.assertEqual(p["totalLengthM"], 55.5)
        previous = 0.0
        for row in p["segments"]:
            self.assertAlmostEqual(row["startM"], previous, places=6)
            self.assertGreater(row["endM"], row["startM"])
            self.assertAlmostEqual(row["endM"]-row["startM"], row["lengthM"], places=6)
            previous = row["endM"]
        self.assertAlmostEqual(previous, p["totalLengthM"], places=6)

    def test_not_misrepresented_as_certified_current_building(self):
        p = self.proof
        self.assertEqual(p["status"], "drawing-local-unregistered")
        self.assertIsNone(p["geoRegistration"])
        self.assertFalse(p["currentFacadeVerified"])
        self.assertFalse(p["publishedModel"])
        self.assertIn("historique", p["basis"])
        self.assertGreaterEqual(len(p["unknowns"]), 4)

    def test_embedded_evidence_is_exact_and_preview_is_self_contained(self):
        html = self.html
        matches = re.findall(
            r'<script id="evidence" type="application/json">([\s\S]*?)</script>', html)
        self.assertEqual(len(matches), 1)
        embedded = json.loads(matches[0])
        self.assertEqual(embedded, self.proof)
        self.assertIn("#ded0b9", html)
        self.assertIn("sans profondeur", html.lower())
        self.assertIn("non publié dans le jeu", html.lower())
        self.assertNotIn("https://cdn.", html)
        for target in ('id="scene"', 'id="track"', 'id="range"',
                       'id="focus"', 'id="yaw"', 'id="detail"'):
            self.assertIn(target, html)

    def test_inline_interaction_javascript_is_syntactically_valid(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("Node absent sur cette machine")
        scripts = re.findall(r'<script(?:[^>]*)>([\s\S]*?)</script>', self.html)
        self.assertEqual(len(scripts), 2)
        with tempfile.TemporaryDirectory() as folder:
            script = Path(folder) / "evidence.js"
            script.write_text(scripts[-1], encoding="utf8")
            proc = subprocess.run([node, "--check", str(script)],
                                  capture_output=True, text=True, timeout=20)
        self.assertEqual(proc.returncode, 0, proc.stderr)


if __name__ == "__main__":
    unittest.main()
