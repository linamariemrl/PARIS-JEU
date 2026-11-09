"""Emprises contrôlées depuis les fichiers IGN, sans cote de façade inventée."""
import unittest, json, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
from prepare_architecture_survey_4e import survey
def load(p):return json.loads((ROOT/p).read_text(encoding="utf8"))
def src(p):return (ROOT/p).read_text(encoding="utf8")

class ArchitecturalSurvey026(unittest.TestCase):
 def test_corpus_is_recomputed_from_real_ign_tiles(self):
  generated=survey()
  stored=load("public/data/metropole/architecture/survey-4e.json")
  self.assertEqual(stored,generated)
  self.assertEqual(len(generated["sites"]),3)
  ids=[x["ignBuildingId"] for x in generated["sites"]]
  self.assertEqual(len(ids),len(set(ids)))
  for x in generated["sites"]:
   self.assertFalse(x["exactMonumentModelCertified"])
   self.assertFalse(x["architecturalFacadeMeasured"])
   self.assertTrue(x["sourceNotice"].startswith("https://pop.culture.gouv.fr/"))
   self.assertGreater(x["footprint"]["pointCount"],15)
   self.assertGreater(x["footprint"]["areaM2"],1000)
   self.assertGreater(x["footprint"]["heightIgnMeters"],10)
 def test_hotel_complexity_and_mnh_roof_evidence_are_reported(self):
  h=next(x for x in survey()["sites"] if x["ref"]=="PA00086319")
  self.assertEqual(h["ignBuildingId"],"BATIMENT0000000245157267")
  self.assertEqual(h["footprint"]["pointCount"],592)
  self.assertAlmostEqual(h["footprint"]["areaM2"],10251.55,places=1)
  self.assertAlmostEqual(h["footprint"]["bboxWidthM"],125.82,places=1)
  self.assertAlmostEqual(h["footprint"]["bboxDepthM"],163.09,places=1)
  self.assertEqual(h["footprint"]["heightIgnMeters"],25.2)
  self.assertEqual(h["cityVolumes"]["planarParts"],11)
  self.assertAlmostEqual(h["cityVolumes"]["coverageFraction"],.831)
  # L'association POP/IGN ne constitue pas une mesure des sculptures.
  self.assertFalse(h["cityVolumes"]["internalHeightsMeasured"])
  self.assertTrue(h["lidarRoofMeasured"])
  roof=h["roofEvidence"]
  self.assertIsNotNone(roof)
  self.assertEqual(roof["mosaicTiles"],["metadata.11924","metadata.57713"])
  self.assertEqual(roof["sourcePixelMeters"],.5)
  self.assertEqual(roof["meshGridMeters"],2.5)
  self.assertGreater(roof["coverageFraction"],.98)
  self.assertEqual(roof["triangles"],3490)
  self.assertEqual(roof["measuredVertices"],2047)
  self.assertEqual(roof["maximumMnhHeightM"],48.21)
  self.assertFalse(roof["architecturalFacadesCertified"])
  self.assertFalse(roof["ornamentsCertified"])
 def test_gothic_monuments_have_no_fabricated_pinnacle_height(self):
  n=next(x for x in survey()["sites"] if x["ref"]=="PA00086250")
  self.assertEqual(n["footprint"]["heightIgnMeters"],34.9)
  self.assertFalse(n["exactMonumentModelCertified"])
  self.assertIn("non altitude du clocher",n["footprint"]["heightNotice"])
 def test_source_provenance_is_visible_in_existing_fiches(self):
  code=src("src/architectureDossiers.ts")
  for key in ["survey-4e.json","Emprise polygonale IGN calculée",
    "NE décrivent PAS les cotes des façades","lidarRoofMeasured",
    "roofEvidence","Toiture mesurée IGN MNH"]:
   self.assertIn(key,code)
  self.assertIn("architecture-provenance",code)
  self.assertIn("publicationAllowed",code)
 def test_lidar_priority_no_longer_disqualifies_large_monument(self):
  s=src("scripts/prepare_lidar_roofs_4e.py")
  self.assertIn("HOTEL_DE_VILLE_ID='BATIMENT0000000245157267'",s)
  self.assertIn("max_points=3600 if priority else 500",s)
  self.assertIn("grid=2.5 if priority else 6.0",s)
  self.assertIn("require_coverage=.95 if priority else None",s)
  self.assertIn("if require_coverage is not None and coverage<require_coverage",s)
  self.assertNotIn("if len(raw)<3 or len(raw)>500:return None",s)
  self.assertIn("hotelDeVilleRoofAccepted",s)

if __name__=="__main__": unittest.main()
