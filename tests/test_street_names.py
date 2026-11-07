"""Tests hors ligne des noms de rues officiels de Paris."""
import importlib.util
from pathlib import Path
import unittest
from shapely.geometry import box, mapping, Point

FILE=Path(__file__).resolve().parents[1]/"scripts/prepare_street_names.py"
spec=importlib.util.spec_from_file_location("prepare_street_names", FILE)
mod=importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class TestStreetNames(unittest.TestCase):
    def test_denominations_officielles(self):
        record={"id":12,"nomvoie":"Saint-Louis","typvoie":"pont","prevoie":None}
        self.assertEqual(mod.street_name(record),"pont Saint-Louis")
        self.assertIsNone(mod.street_name({"nomvoie":None}))

    def test_voie_du_4e_geolocalisee(self):
        polygon=box(2.3537,48.8545,2.3539,48.8547)
        record={"id":5,"arrdt":["04e"],"typvoie":"rue","nomvoie":"Exemple",
                "geo_shape":{"type":"Feature","geometry":mapping(polygon)}}
        result=mod.encode_record(record,box(2.35,48.85,2.36,48.86))
        self.assertEqual(result["name"],"rue Exemple")
        self.assertTrue(abs(result["x"])<100)
        self.assertTrue(abs(result["z"])<100)


    def test_repetition_sur_une_rue_longue(self):
        # Géométrie fictive uniquement pour tester l'algorithme, pas une donnée du jeu.
        polygon=box(2.351,48.8545,2.360,48.85457)
        record={"id":80,"arrdt":["04e"],"typvoie":"rue",
                "nomvoie":"Exemple longue",
                "geo_shape":{"type":"Feature","geometry":mapping(polygon)}}
        item=mod.encode_record(record,box(2.35,48.85,2.37,48.86))
        self.assertIsNotNone(item)
        self.assertGreaterEqual(len(item["placements"]),3)
        xy=mod.transform(mod.local,polygon)
        for anchor in item["placements"]:
            self.assertTrue(xy.buffer(0.5).covers(Point(anchor["x"],anchor["z"])))

    def test_rue_courte_ne_se_repete_pas(self):
        polygon=box(2.3537,48.8545,2.35385,48.85454)
        self.assertEqual(len(mod.road_anchors(polygon)),1)

    def test_rejet_hors_arrondissement(self):
        record={"arrdt":["05e"],"nomvoie":"Exemple"}
        self.assertIsNone(mod.encode_record(record,box(2.35,48.85,2.36,48.86)))

if __name__=="__main__":
    unittest.main()
