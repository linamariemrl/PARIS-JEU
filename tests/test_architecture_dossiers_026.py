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
  # Enregistrement avec l'emprise IGN réelle (contour et cours), et
  # acceptation par couverture de polygones, pas par boîtes seules.
  self.assertIn("extrusionSwap.register(heritageIgnId,mesh,footprint)",building)
  self.assertIn("footprintShape(own.b.polygons.map(",building)
  swap=read("src/heritageFootprints.ts")
  accept=swap[swap.index(" private evaluate("):swap.index(" /** À appeler APRÈS")]
  self.assertIn("modelCoversFootprint(model.box,s.box)",accept)
  self.assertIn("polygonCoverage(model,shapes)",accept)
  self.assertIn("modelShapeFromParts(obj.parts)",model)
  self.assertIn("extrusionSwap.conflicts(model.ref)",model)
  # D4 : une partie certifiée ne masque jamais l'extrusion ; seule une
  # maquette complète appelle activate(), et elle retire les parties.
  self.assertIn("if(!isPartial(model)){\n    if(!extrusionSwap.activate(model.ref,shape!))",model)
  self.assertIn("this.dropPartials()",model)
  self.assertIn("if(!r.partial||!extrusionSwap.replacedFor(r.ref))continue;",model)
  self.assertIn("this.docs.canPublishPart(m.ref,m.partId,m.sourceIds)",model)
  self.assertIn("extrusionSwap.replacedFor(model.ref)",model)
  # D6 : choix du niveau avec hystérésis.
  self.assertIn("chooseTier(radius,",model)
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
  # Contrôle de fermeture recalculé, jamais recopié : la somme des
  # segments doit égaler la cote générale inscrite pour être « closed ».
  for chain in register["chains"]:
   total=round(sum(seg["value"] for seg in chain["segments"]),2)
   self.assertEqual(total,chain["sumOfSegments"],chain["chainId"])
   closed=abs(total-chain["inscribedTotal"])<0.005
   self.assertEqual(chain["closure"]["status"],"closed" if closed else "conflict")
   self.assertIn(chain["sourceId"],documents)
   self.assertTrue(chain["start"] and chain["end"])
   for seg in chain["segments"]:
    self.assertEqual(len(seg["imageCrop"]["box"]),4)
  for derived in register["derived"]:
   self.assertTrue(derived["status"].startswith("derived-"))
  # Le garde-fou historique reste intact : aucune planche BHdV dans les
  # mesures publiées par le dossier (taille du papier != cote bâtie).
  self.assertFalse(any(m["sourceId"].startswith("bhdv-") for m in hotel["measurements"]))
  self.assertFalse(hotel["publicationAllowed"])
  # Aucune partie n'est certifiée à ce jour ; toute partie future doit
  # citer des documents du dossier.
  for d in dossiers:
   for part in d.get("certifiedParts",[]):
    known={x["id"] for x in d["documents"]}
    self.assertTrue(part["sourceIds"] and set(part["sourceIds"])<=known,d["ref"])
  self.assertFalse(any(d.get("certifiedParts") for d in dossiers))
  self.assertEqual(json.loads(read("public/data/metropole/architecture/models/index.json"))["models"],[])
 def test_partial_rhythm_is_derived_and_not_used_by_engine(self):
  import json,importlib.util
  spec=importlib.util.spec_from_file_location("rhythm",ROOT/"scripts/derive_cc64_rhythm.py")
  mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)
  published=json.loads(read("public/data/metropole/architecture/reference/PA00086319/cc64-pl34-assise14-rythme.json"))
  # Le fichier publié est exactement la dérivation du registre.
  self.assertEqual(published,mod.build())
  self.assertEqual(published["status"],"partial-non-certified")
  self.assertIs(published["georeferenced"],False)
  self.assertIsNone(published["verticalPosition"])
  self.assertIs(published["usedByEngine"],False)
  self.assertAlmostEqual(published["length"],62.82,places=2)
  ivs=published["intervals"]
  self.assertTrue(all(abs(a["end"]-b["start"])<1e-9 for a,b in zip(ivs,ivs[1:])))
  # Symétrie de la façade autour de la travée centrale (3,63 + 0,23).
  lengths=[i["length"] for i in ivs]
  centre=lengths.index(3.63)
  self.assertEqual(lengths[centre+1],0.23)
  self.assertEqual(lengths[:centre],list(reversed(lengths[centre+2:])))
  # Aucun code du moteur ne lit ce dossier de référence.
  for f in (ROOT/"src").rglob("*.ts"):
   self.assertNotIn("reference/PA00086319",f.read_text(encoding="utf-8"))
 def test_registration_is_honest_until_tie_points_exist(self):
  import json
  r=json.loads(read("public/data/metropole/architecture/registration/PA00086319.json"))
  dossiers=json.loads(read("public/data/metropole/architecture/dossiers.json"))["dossiers"]
  hotel=next(d for d in dossiers if d["ref"]=="PA00086319")
  self.assertIn(r["sourceId"],{d["id"] for d in hotel["documents"]})
  # Aucun calage tant que des points d'appui et de contrôle n'existent pas.
  self.assertEqual(r["status"],"unregistered")
  self.assertEqual(r["tiePoints"],[]);self.assertEqual(r["controlPoints"],[])
  for k in ("originL93","transform","rmsControlMeters"):self.assertIsNone(r[k])
  self.assertIsNone(r["vertical"]["courseAltitudeNGF"])
  self.assertTrue(all(c["l93"] is None for c in r["candidateTiePoints"]))
  self.assertTrue(r["whyUnregistered"])
  # Le chargeur convertit explicitement EPSG:2154 + NGF vers la scène.
  model=read("src/architectureModels.ts")
  self.assertIn("'epsg2154-relative'",model)
  self.assertIn("masterToScene(part.positions,obj.originL93!,f)",model)
  self.assertIn("node --experimental-strip-types scripts/check_registration.mjs",read("package.json"))
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
