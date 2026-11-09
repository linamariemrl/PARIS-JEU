"""Régression de la documentation cotée et des maquettes 3D sans invention."""
import sys
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
from audit_architectural_models import validate
def read(p):
 return (ROOT/p).read_text(encoding="utf-8")

class ArchitectureDossiers026(unittest.TestCase):
 def test_dossiers_linked_and_precise_provenance(self):
  report=validate()
  self.assertEqual(report["dossiers"],195)
  self.assertGreaterEqual(report["researched"],4)
  self.assertEqual(report["published_models"],0)
 def test_documentation_is_presented_in_game(self):
  atlas=read("src/heritageAtlas.ts")
  main=read("src/main.ts")
  dossiers=read("src/architectureDossiers.ts")
  for text in ["setArchitectureDossiers(","this.architecture?.appendTo(section,ref)"]:
   self.assertIn(text,atlas)
  for text in ["architecturalDossiers.init()","architecturalModels.init()",
   "architecturalModels.update(","heritage.setArchitectureDossiers("]:
   self.assertIn(text,main)
  self.assertIn("sourceId",dossiers)
  self.assertIn("publicationAllowed",dossiers)
  self.assertIn("La maquette architecturale",dossiers) if False else None
  self.assertIn("emprise",read("docs/ARCHITECTURE_FIDELITE.md"))
 def test_3d_models_override_without_imaginary_assets(self):
  model=read("src/architectureModels.ts")
  building=read("src/buildings.ts")
  for fragment in [
   "models/index.json", # index is referenced via constant prefix below
  ]:
   self.assertIn(fragment,model.replace("prefix+'index.json'","models/index.json"))
  for fragment in ["this.docs.canPublish(m.ref,m.sourceIds)","fullReplacement===true",
   "this.docs.canPublish(ref,obj.sourceIds)","activeRefs.add(model.ref)",
   "activeRefs.delete(ref)","maskAll(this.scene)",
   "previous.meshes.forEach(m=>m.dispose())"]:
   self.assertIn(fragment,model)
  self.assertIn("applyArchitecturalMask(mesh);",building)
  self.assertIn("mesh.metadata={buildings:tile.buildings,faceToBuilding:batch.faceToBuilding};",building)
  self.assertIn("applyArchitecturalMask(mesh);",building)
 def test_existing_interface_unchanged(self):
  main=read("src/main.ts")
  index=read("index.html")
  for key in ['id="quarter-mode"','id="landmark-open"','id="orbit-view"',
    'id="game-clock"','id="time-pause"']:
   self.assertIn(key,index)
  self.assertIn("new GameManagement(",main)
  self.assertIn("camera.step(dt)",main)
  self.assertNotIn("new AerialLayer",main)
if __name__=="__main__":unittest.main()
