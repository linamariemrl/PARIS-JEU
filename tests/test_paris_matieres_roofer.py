"""Contrôles J1 : emprises authentiques, provenance et aucune fausse certification."""
from __future__ import annotations
import hashlib
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
import paris_matieres_roofer as mr


class ParisMatieresRoofer(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.base = self.root / "base"
        self.id = "bat:BATIMENT0000000305564422"
        self.doc = {
            "schema": "paris-unite/1", "id": self.id, "type": "batiment",
            "versionBase": "sha256:1234567890abcdef",
            "georeferencement": {
                "crs": "EPSG:2154", "altimetrie": "NGF-IGN69",
                "ancre": {"e": 652000.0, "n": 6862000.0, "altitude": 35.0},
                "emprise2154": [
                    [[[652000, 6862000], [652020, 6862000], [652020, 6862020],
                      [652000, 6862020], [652000, 6862000]],
                     [[652005, 6862005], [652005, 6862010], [652010, 6862010],
                      [652010, 6862005], [652005, 6862005]]]
                ],
            },
        }
        folder = mr.directory(self.base, self.id)
        folder.mkdir(parents=True)
        (folder / "unite.json").write_text(json.dumps(self.doc), encoding="utf8")

    def test_reads_source_identity_without_touching_anchor(self):
        out = mr.read_building(self.id, self.base)
        self.assertEqual(out["versionBase"], self.doc["versionBase"])
        self.assertEqual(out["georeferencement"]["ancre"],
                         self.doc["georeferencement"]["ancre"])
        with self.assertRaisesRegex(ValueError, "bâtiment"):
            mr.read_building("sol:-2_-1", self.base)

    def test_preserves_inner_courtyard_without_fabrication(self):
        geo = mr.footprint_geometry(self.doc)
        self.assertEqual(geo["type"], "MultiPolygon")
        self.assertEqual(len(geo["coordinates"]), 1)
        self.assertEqual(len(geo["coordinates"][0]), 2)
        from shapely.geometry import shape
        self.assertAlmostEqual(shape(geo).area, 375.0)
        self.doc["georeferencement"]["emprise2154"][0][1][0] = [653000, 6863000]
        with self.assertRaisesRegex(ValueError, "invalide"):
            mr.footprint_geometry(self.doc)

    def test_geopackage_explicitly_declares_epsg2154(self):
        try:
            import fiona
        except ImportError:
            self.skipTest("Fiona est facultatif hors machine de production")
        output = self.root / "work"
        gpkg = mr.write_footprint(self.doc, output)
        with fiona.open(gpkg, layer="empreintes") as layer:
            self.assertEqual(len(layer), 1)
            self.assertEqual(layer.crs.to_epsg(), 2154)
            feature = next(iter(layer))
            self.assertEqual(feature["geometry"]["type"], "MultiPolygon")
            self.assertEqual(feature["properties"]["identifiant"], self.id[4:])
        state = json.loads((output / "entree.json").read_text(encoding="utf8"))
        self.assertEqual(state["etat"], "empreinte-préparée-sans-lidar")
        self.assertEqual(state["ancre"], self.doc["georeferencement"]["ancre"])

    def test_lidar_source_requires_checksum_and_open_provenance(self):
        cloud = self.root / "LHD_FXX_0652_6862.laz"
        cloud.write_bytes(b"synthetic-data-for-checksum-test-not-a-lidar")
        digest = hashlib.sha256(cloud.read_bytes()).hexdigest()
        source = self.root / "origine.json"
        value = {"id": "ign-lidar-hd", "url": "https://data.geopf.fr/ressources/test.laz",
                 "licence": "Licence Ouverte 2.0", "sha256": digest,
                 "dateAcquisition": "2026-11-11", "dalle": "LHD_FXX_0652_6862"}
        source.write_text(json.dumps(value), encoding="utf8")
        self.assertEqual(mr.check_lidar_source(cloud, source)["sha256"], digest)
        for wrong in (dict(value, sha256="0" * 64),
                      dict(value, url="https://earth.google.com/test.laz"),
                      dict(value, licence="propriétaire")):
            source.write_text(json.dumps(wrong), encoding="utf8")
            with self.assertRaises(ValueError):
                mr.check_lidar_source(cloud, source)

    def test_roofer_is_only_called_on_existing_inputs_and_never_by_shell(self):
        cloud = self.root / "data.las"
        gpkg = self.root / "foot.gpkg"
        cloud.write_bytes(b"x")
        gpkg.write_bytes(b"y")
        with patch.object(mr.shutil, "which", return_value="/usr/bin/roofer"):
            cmd = mr.roofer_command(cloud, gpkg, self.root / "out")
        self.assertEqual(cmd[:4], ["roofer", "--lod12", "--lod22", "--split-cjseq"])
        self.assertEqual(cmd[4], str(cloud.resolve()))
        cloud.unlink()
        with self.assertRaises(ValueError):
            mr.roofer_command(cloud, gpkg, self.root / "out")


if __name__ == "__main__":
    unittest.main()
