"""Contrôles du fournisseur WFS et du cache LiDAR HD : aucun accès réseau réel."""
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
import paris_matieres_sources as src
import paris_matieres_roofer as roof


class Response:
    def __init__(self, data: bytes, url: str):
        self.data, self.url, self.position = data, url, 0
        self.headers = {"Content-Length": str(len(data))}

    def __enter__(self):
        return self

    def __exit__(self, *_):
        return False

    def geturl(self):
        return self.url

    def read(self, n=-1):
        if n < 0:
            n = len(self.data) - self.position
        block = self.data[self.position:self.position + n]
        self.position += len(block)
        return block


class ParisMatieresSources(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.folder = Path(self.tmp.name)
        self.dalle = "LHD_FXX_0652_6862"
        self.index = "https://data.geopf.fr/wfs/ows?SERVICE=WFS&REQUEST=GetFeature"
        self.cloud = "https://data.geopf.fr/ign/LHD_FXX_0652_6862.copc.laz"
        self.unit = {"id": roof.read_building.__name__,
                     "versionBase": "sha256:1234567890abcdef",
                     "sourcesGratuites": [
                         {"id": "ign-lidar-hd", "licence": "Licence Ouverte 2.0",
                          "dalles1km": [self.dalle], "index": self.index}
                     ]}

    def test_source_pointer_must_be_official_and_dalle_declared(self):
        pointer = src.source_pointer(self.unit, self.dalle)
        self.assertEqual(pointer["index"], self.index)
        with self.assertRaisesRegex(ValueError, "Dalle"):
            src.source_pointer(self.unit, "LHD_FXX_0000_0000")
        self.unit["sourcesGratuites"][0]["index"] = "https://earth.google.com/not-wfs"
        with self.assertRaises(ValueError):
            src.source_pointer(self.unit, self.dalle)

    def test_wfs_chooses_exact_tile_not_nearest(self):
        feat = {"type": "Feature", "id": "abc",
                "properties": {"nom_dalle": self.dalle,
                               "url_npl": self.cloud,
                               "url_mnt": "https://data.geopf.fr/ign/mnt.tif"}}
        collection = {"type": "FeatureCollection", "features": [feat]}
        self.assertEqual(src.choose_metadata(collection, self.dalle)["url_npl"], self.cloud)
        with self.assertRaisesRegex(ValueError, "unique"):
            src.choose_metadata({"type": "FeatureCollection",
                                 "features": [feat, feat]}, self.dalle)
        with self.assertRaisesRegex(ValueError, "unique"):
            src.choose_metadata({"type": "FeatureCollection", "features": [
                {"type": "Feature", "properties": {"url_npl": self.cloud}}
            ]}, "LHD_FXX_0999_0999")

    def test_probe_uses_wfs_and_never_downloads_cloud(self):
        payload = {"type": "FeatureCollection", "features": [
            {"type": "Feature", "properties": {
                "nom_dalle": self.dalle, "url_npl": self.cloud}}
        ]}
        raw = json.dumps(payload).encode("utf8")
        with patch.object(src, "urlopen", return_value=Response(raw, self.index)) as access:
            result = src.probe(self.unit, self.dalle)
        self.assertEqual(access.call_count, 1)
        self.assertEqual(result["etat"], "meta-officielle-verifiee-sans-telechargement")
        self.assertEqual(result["fichiers"]["url_npl"], self.cloud)

    def test_download_is_atomic_cached_and_verified_by_roofer(self):
        payload = b"LASF" + b"\x00" * 96
        meta = {"dalle": self.dalle, "fichiers": {"url_npl": self.cloud},
                "licence": "Licence Ouverte 2.0", "indexWfs": self.index}
        with patch.object(src, "urlopen", return_value=Response(payload, self.cloud)) as access:
            result = src.download(meta, self.folder, limit_mb=1)
        self.assertEqual(result["etat"], "telecharge-avec-provenance")
        self.assertEqual(result["sha256"], hashlib.sha256(payload).hexdigest())
        self.assertTrue(Path(result["fichier"]).exists())
        self.assertEqual(roof.check_lidar_source(Path(result["fichier"]),
                                                  Path(result["manifeste"]))["sha256"],
                         result["sha256"])
        with patch.object(src, "urlopen", side_effect=AssertionError("nouveau téléchargement")):
            reuse = src.download(meta, self.folder, limit_mb=1)
        self.assertEqual(reuse["etat"], "cache-valide")
        self.assertEqual(access.call_count, 1)

    def test_wrong_header_and_forbidden_domains_are_rejected(self):
        meta = {"dalle": self.dalle, "fichiers": {"url_npl": self.cloud},
                "licence": "Licence Ouverte 2.0", "indexWfs": self.index}
        with patch.object(src, "urlopen", return_value=Response(b"<html>error</html>", self.cloud)):
            with self.assertRaisesRegex(ValueError, "LAS"):
                src.download(meta, self.folder, limit_mb=1)
        self.assertFalse(list(self.folder.glob("*.part")))
        meta["fichiers"]["url_npl"] = "https://earth.google.com/3d.laz"
        with self.assertRaises(ValueError):
            src.download(meta, self.folder, limit_mb=1)


if __name__ == "__main__":
    unittest.main()
