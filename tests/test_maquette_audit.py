import unittest
import importlib.util
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location(
    "maquette",ROOT/"scripts/audit_maquette_4e.py"
)
module=importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

class AuditMaquette(unittest.TestCase):
    def test_inventory_exact_and_grounded(self):
        a=module.audit()
        self.assertEqual(a["buildingCount"],2696)
        self.assertEqual(a["tileCount"],27)
        self.assertEqual(a["roofsWithDocumentedShape"],59)
        self.assertEqual(a["cityVolumesInSource"],8664)
        self.assertEqual(a["cityVolumeMatches"],894)
        self.assertGreater(a["eligibleRefinedBuildings"],400)
        self.assertEqual(a["heightMeasuredCount"]+
                         a["heightEstimatedCount"],2696)
        self.assertEqual(a["roofsWithDocumentedShape"]+
                         a["roofsWithoutDocumentedShape"],2696)
