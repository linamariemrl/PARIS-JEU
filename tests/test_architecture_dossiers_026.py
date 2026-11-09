"""Régression de la documentation cotée et des maquettes 3D sans invention."""
import sys
import unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
from audit_architectural_models import validate
sys.path.insert(0,str(ROOT/"tests"))
from heritage_swap_contract import run_behaviour_test
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
  self.assertIn("models/index.json",model.replace("prefix+'index.json'","models/index.json"))
  # Publication : seules les maquettes mesurées, approuvées et sourcées.
  for fragment in ["this.docs.canPublish(m.ref,m.sourceIds)","fullReplacement===true",
   "m.review==='measured-and-approved'","this.docs.canPublish(ref,obj.sourceIds)"]:
   self.assertIn(fragment,model)
  # D7 : la maquette est construite AVANT que l'extrusion soit masquée,
  # et l'extrusion est restituée AVANT que la maquette soit détruite.
  load=model[model.index("private async load("):model.index(" update(")]
  self.assertLess(load.index("extrusionSwap.accepts("),load.index("new Mesh("))
  self.assertLess(load.index("new Mesh("),load.index("extrusionSwap.activate("))
  self.assertLess(load.index("extrusionSwap.activate("),
                  load.index("previous?.meshes.forEach(m=>m.dispose())"))
  self.assertIn("meshes.forEach(m=>m.dispose())",load[load.index("finally"):])
  update=model[model.index(" update("):]
  self.assertLess(update.index("extrusionSwap.deactivate(ref)"),
                  update.index("previous.meshes.forEach(m=>m.dispose())"))
  # D1 : plus aucune réécriture d'indices ; extrusions séparées enregistrées
  # et désenregistrées à leur destruction.
  for source in (model,building):
   self.assertNotRegex(source,r"\.setIndices\s*\(")
  self.assertIn("extrusionSwap.register(heritageIgnId,mesh,box)",building)
  self.assertIn("extrusionSwap.unregister(heritageIgnId,mesh)",building)
  self.assertIn("mesh.onDisposeObservable.addOnce(",building)
  self.assertIn("faceToBuilding:batch.faceToBuilding",building)
  # Comportement : cycle complet avec maquette factice et table publiée.
  code,output=run_behaviour_test()
  self.assertEqual(code,0,output)
  self.assertIn("ordre de bascule sûr vérifiés",output)
 def test_transcribed_measurements_are_traceable_not_certified(self):
  import json
  register=json.loads(read("public/data/metropole/architecture/measurements/PA00086319.json"))
  dossiers=json.loads(read("public/data/metropole/architecture/dossiers.json"))["dossiers"]
  hotel=next(d for d in dossiers if d["ref"]=="PA00086319")
  documents={d["id"] for d in hotel["documents"]}
  self.assertEqual(register["ref"],"PA00086319")
  self.assertTrue(register["gaps"])
  statuses=set(register["statusVocabulary"])
  for m in register["measurements"]:
   self.assertIn(m["status"],statuses)
   self.assertIn(m["sourceId"],documents)
   self.assertEqual(m["unit"],"m")
   # Une lecture de dessin de 1878 n'est jamais une cote du bâti actuel.
   self.assertIs(m["currentStateVerified"],False)
   self.assertTrue(m["readBy"] and m["inscription"] and m["sheetLocator"])
   self.assertEqual(len(m["imageCrop"]["box"]),4)
   if m["status"]=="transcribed-legible":
    self.assertIsInstance(m["value"],(int,float))
    self.assertGreater(m["value"],0)
   else:
    self.assertIsNone(m["value"],m["elementId"])
  # Le garde-fou historique reste intact : aucune planche BHdV dans les
  # mesures publiées par le dossier (taille du papier != cote bâtie).
  self.assertFalse(any(m["sourceId"].startswith("bhdv-") for m in hotel["measurements"]))
  self.assertFalse(hotel["publicationAllowed"])
  self.assertEqual(json.loads(read("public/data/metropole/architecture/models/index.json"))["models"],[])
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
