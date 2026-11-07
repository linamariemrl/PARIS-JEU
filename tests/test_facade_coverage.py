"""Les rapports ne doivent pas prétendre observer une façade sans image source."""
import json
import unittest
import importlib.util
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location("facade_coverage",ROOT/"scripts/prepare_facade_coverage.py")
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
class FacadeProvenance(unittest.TestCase):
    def test_counts_grounded_in_ign_osm_cadastre(self):
        report=module.build()
        self.assertEqual(report["buildingsIGN"],2696)
        self.assertEqual(report["tilesIGN"],27)
        self.assertEqual(report["knownCadastreWallMaterial"],1315)
        self.assertEqual(report["knownCadastreRoofMaterial"],1334)
        self.assertEqual(report["OSMRoofShapesMatched"],59)
        self.assertGreater(report["potentialExteriorContourEdges"],10000)

    def test_no_photographs_no_observed_facades(self):
        r=module.build()
        self.assertEqual(r["photographicallyObservedFacades"],0)
        self.assertEqual(r["distinctFacadeRecordsLinkedToStreet"],0)
        licences=json.loads((ROOT/"data/sources/licences.json").read_text(encoding="utf-8"))
        self.assertFalse(licences["importedPhotographs"])
        self.assertTrue(all(s["status"]!="utilisé" or s["license"] for s in licences["sources"]))
