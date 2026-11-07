import importlib.util,sys,unittest
from pathlib import Path
from shapely.geometry import Polygon
ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"scripts"))
spec=importlib.util.spec_from_file_location("prepare_roof_shapes",ROOT/"scripts/prepare_roof_shapes.py")
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

def osm(id,poly,roof):
    return {"type":"way","id":id,"tags":{"roof:shape":roof},
            "geometry":[{"lon":x,"lat":y} for x,y in poly]}

class RoofTests(unittest.TestCase):
    def test_juste_une_emprise_suffisamment_identique(self):
        rect=[(2.35,48.85),(2.351,48.85),(2.351,48.851),
              (2.35,48.851),(2.35,48.85)]
        records,skipped=mod.join(
            [osm(12,rect,"gabled")],
            [("IGN-A",Polygon(rect)),("IGN-B",Polygon([
                 (2.36,48.85),(2.361,48.85),(2.361,48.851),
                 (2.36,48.851),(2.36,48.85)
            ]))])
        self.assertEqual(records["IGN-A"]["shape"],"gabled")
        self.assertNotIn("IGN-B",records)
    def test_pas_de_forme_inconnue(self):
        ring=[(2.35,48.85),(2.351,48.85),(2.351,48.851),
              (2.35,48.851),(2.35,48.85)]
        r,skipped=mod.join([osm(1,ring,"imaginary")],[("IGN-A",Polygon(ring))])
        self.assertEqual(r,{})
        self.assertEqual(skipped["unsupported"],1)
    def test_hauteurs_manquantes_pas_fabriquees(self):
        self.assertIsNone(mod.height(None))
        self.assertIsNone(mod.height("inconnu"))
        self.assertEqual(mod.height("4.25 m"),4.25)
        self.assertIsNone(mod.height("90"))
if __name__=="__main__":unittest.main()
