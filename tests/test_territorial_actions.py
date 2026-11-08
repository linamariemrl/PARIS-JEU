"""Contrat : réseau de voirie sélectionnable et dossiers persistants."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]
def src(p):return (ROOT/p).read_text(encoding="utf-8")

class TerritorialActions(unittest.TestCase):
 def test_road_contrast_and_selection(self):
  infra=src("src/infrastructure.ts")
  self.assertIn("road: [.55,.56,.57]",infra)
  self.assertIn("sidewalk: [.86,.86,.86]",infra)
  self.assertIn("mesh.isPickable = kind === 'road'",infra)
  self.assertIn("street-names.json",src("src/streetDirectory.ts"))
  self.assertIn("mesh.name==='infrastructure-road'",src("src/main.ts"))
 def test_dossiers_are_real_controls(self):
  main=src("src/main.ts")
  html=src("index.html")
  ui=src("src/simulation/ui.ts")
  for key in ['action-observe','action-priority','action-dossier','dossier-list']:
   self.assertIn('id="'+key+'"',html)
  self.assertIn("registerDossier",ui)
  self.assertIn("this.saves.put(this.currentSlot,this.snapshot())",ui)
  self.assertIn("management?.tickDossiers()",main)
 def test_save_compatibility(self):
  save=src("src/simulation/saveStore.ts")
  self.assertIn("dossiers?:Dossier[]",save)
  self.assertIn("validateDossiers(x.dossiers)",save)
  self.assertIn("PROTOTYPE 0.24",src("index.html"))

if __name__=="__main__":unittest.main()
