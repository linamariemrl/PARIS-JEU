"""Vérification de la correspondance exacte des matériaux fonciers."""
import importlib.util
import unittest
import sys
from pathlib import Path
root=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(root/"scripts"))
spec=importlib.util.spec_from_file_location("prepare_materials",root/"scripts/prepare_materials.py")
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

class MaterialCodes(unittest.TestCase):
    def test_codes_indetermines_ne_sont_pas_reinventes(self):
        self.assertIsNone(mod.material_code("00",True))
        self.assertIsNone(mod.material_code(None,False))
        self.assertIsNone(mod.material_code("90",False))
        self.assertIsNone(mod.material_code("9A",True))
        self.assertIsNone(mod.material_code("09",True))

    def test_codes_fonciers_sont_decodes_sans_extrapolation(self):
        self.assertEqual(mod.decode(mod.material_code("14",True),True),["pierre","brique"])
        self.assertEqual(mod.decode(mod.material_code("23",False),False),["ardoise","zinc/aluminium"])
        self.assertEqual(mod.decode(mod.material_code("30",False),False),["zinc/aluminium"])
        self.assertEqual(mod.decode(mod.material_code("10",True),True),["pierre"])

    def test_jointure_uniquement_par_identifiant(self):
        features=[
            {"properties":{"cleabs":"A","materiaux_des_murs":"10","materiaux_de_la_toiture":"30","nombre_d_etages":5}},
            {"properties":{"cleabs":"B","materiaux_des_murs":"00","materiaux_de_la_toiture":"00"}},
            {"properties":{"cleabs":"Z","materiaux_des_murs":"40","materiaux_de_la_toiture":"20"}},
        ]
        records,counts,matched=mod.collect(features,{"A","B"})
        self.assertEqual(matched,2)
        self.assertEqual(records["A"],{"wall":"10","roof":"30","floors":5})
        self.assertNotIn("B",records)
        self.assertNotIn("Z",records)
        self.assertEqual(counts["walls"],1)

if __name__=="__main__":
    unittest.main()
