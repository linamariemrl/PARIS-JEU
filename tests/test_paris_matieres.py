"""Contrats de l'ordonnanceur PARIS Matières M0 (sans téléchargement externe)."""
from __future__ import annotations
import contextlib
import io
import json
import sys
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import paris_matieres as pm


class ParisMatieresM0(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        self.base = self.root / "export"
        self.retours = self.root / "retours"
        self.cat = self.root / "catalogue.json"
        self.fps = self.root / "empreintes.json"
        self.pilot = pm.PILOT
        self.major = "bat:BATIMENT0000000000000001"
        self.other = "bat:BATIMENT0000000000000002"
        self.data = {
            "schema": "paris-unite/1/catalogue",
            "colonnes": ["id", "tuileJeu", "x", "z", "versionBase"],
            "batiments": [
                [self.other, "0_0", 20, 10, "sha256:1111111111111111"],
                [self.major, "1_0", 230, 50, "sha256:2222222222222222"],
                [self.pilot, "-1_-1", -300, -100, "sha256:3333333333333333"]
            ],
            "sols": ["sol:-2_-1", "sol:0_0", "sol:1_0"],
        }
        self.cat.write_text(json.dumps(self.data), encoding="utf8")
        self.fps.write_text(json.dumps({"entries": [
            {"ref": "PA00000001", "ignIds": [self.major[4:]]}
        ]}), encoding="utf8")

    def test_identity_is_path_safe(self):
        for uid in (self.pilot, self.major, "sol:-2_-1", "sol:0_0"):
            self.assertEqual(pm.directory(self.base, uid).parent.parent, self.base)
        for uid in ("../etc/passwd", "bat:../../main", "sol:1/2",
                    "bat:BATIMENT123", "sol:+1_2", "sol:1_2/../4"):
            with self.assertRaises(ValueError):
                pm.parse_id(uid)

    def test_deterministic_priority_and_ground_first(self):
        catalogue = pm.load_catalogue(self.cat)
        majors = pm.known_majors(self.fps)
        jobs = pm.plan(catalogue, majors)
        self.assertEqual(jobs[0], ("sol:-2_-1", "pilote-sol"))
        self.assertEqual(jobs[1], (self.pilot, "pilote-notre-dame"))
        self.assertLess([uid for uid, _ in jobs].index("sol:1_0"),
                        [uid for uid, _ in jobs].index(self.major))
        self.assertEqual(len(jobs), len(self.data["batiments"]) + len(self.data["sols"]))
        self.assertEqual(len({uid for uid, _ in jobs}), len(jobs))
        self.assertEqual(jobs, pm.plan(catalogue, majors))

    def test_never_loses_building_without_ground(self):
        self.data["sols"].remove("sol:1_0")
        self.cat.write_text(json.dumps(self.data), encoding="utf8")
        jobs = pm.plan(pm.load_catalogue(self.cat), pm.known_majors(self.fps))
        self.assertIn(self.major, [uid for uid, _ in jobs])
        self.assertEqual(len(jobs), 5)

    def test_refuses_duplicate_and_unexpected_catalogue(self):
        self.data["batiments"].append(self.data["batiments"][0])
        self.cat.write_text(json.dumps(self.data), encoding="utf8")
        with self.assertRaisesRegex(ValueError, "Doublon"):
            pm.load_catalogue(self.cat)
        self.data["batiments"].pop()
        self.data["schema"] = "paris-unite/999"
        self.cat.write_text(json.dumps(self.data), encoding="utf8")
        with self.assertRaisesRegex(ValueError, "Schéma"):
            pm.load_catalogue(self.cat)

    def test_return_is_never_accepted_without_base_and_validator(self):
        ret = pm.directory(self.retours, self.pilot)
        ret.mkdir(parents=True)
        (ret / "unite.json").write_text(json.dumps({
            "id": self.pilot, "versionBase": "sha256:3333333333333333",
            "etat": "enrichie", "georeferencement": {"ancre": {"e": 1, "n": 2, "altitude": 3}},
            "enrichissement": {"outil": "non-verifie", "version": "1",
                              "date": "2026-11-11", "sources": [
                                  {"id": "ign", "licence": "Licence Ouverte 2.0"}]}
        }), encoding="utf8")
        self.assertEqual(pm.acceptance(self.pilot, self.base, self.retours)["etat"], "base_absente")
        base = pm.directory(self.base, self.pilot)
        base.mkdir(parents=True)
        (base / "unite.json").write_text(json.dumps({
            "id": self.pilot, "versionBase": "sha256:3333333333333333",
            "type": "batiment", "georeferencement": {"ancre": {"e": 1, "n": 2, "altitude": 3}}
        }), encoding="utf8")
        status = pm.acceptance(self.pilot, self.base, self.retours)
        self.assertEqual(status["etat"], "refusee")
        self.assertTrue(status["erreurs"])

    def test_cli_prints_unambiguous_queue_without_network(self):
        capture = io.StringIO()
        with contextlib.redirect_stdout(capture):
            code = pm.main(["--base", str(self.base), "--retours", str(self.retours),
                            "--catalogue", str(self.cat), "--patrimoine", str(self.fps),
                            "queue", "--limit", "3"])
        self.assertEqual(code, 0)
        data = json.loads(capture.getvalue())
        self.assertEqual(data["schema"], "paris-matieres/plan-1")
        self.assertEqual(data["aExaminer"], 6)
        self.assertEqual(data["affiches"], 3)
        self.assertEqual(data["taches"][0]["id"], "sol:-2_-1")
        self.assertTrue(all(e["etat"] == "a_traiter" for e in data["taches"]))

    def test_doctor_only_reports_actual_tools(self):
        info = pm.doctor(self.cat)
        self.assertTrue(info["cataloguePresent"])
        self.assertIn("roofer", info["producteurs"])
        self.assertIn("pdal", info["indispensablePourJ1"])
        self.assertIsInstance(info["bibliotheques"]["rasterio"], bool)


if __name__ == "__main__":
    unittest.main()
