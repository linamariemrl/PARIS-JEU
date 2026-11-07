"""Tests des bornes et règles SIG, sans compter de voisins de mémoire."""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
class PerimeterStructure(unittest.TestCase):
 def test_metadata_and_provenance(self):
  s=(ROOT/"scripts/prepare_perimeter.py").read_text(encoding="utf-8")
  self.assertIn("ADMINEXPRESS-COG.LATEST:commune",s)
  self.assertIn("TO_2154",s)
  self.assertIn("sharedBoundaryMeters",s)
  self.assertIn("arrondissements",s)
  self.assertIn('if shared>35:',s)
  self.assertNotIn("Aubervilliers",s)
 def test_workflow_exists(self):
  self.assertTrue((ROOT/".github/workflows/prepare-perimeter.yml").exists())
