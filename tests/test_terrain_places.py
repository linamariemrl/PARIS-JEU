"""Contrats du terrain IGN et des fiches géolocalisées."""
from pathlib import Path
import json
import struct
import unittest

ROOT=Path(__file__).resolve().parents[1]
TERRAIN=ROOT/"public/data/metropole/terrain"

class TerrainAndPlaces(unittest.TestCase):
    def test_terrain_ign_measured_and_complete(self):
        manifest=TERRAIN/"manifest.json"
        if not manifest.exists():
            self.skipTest("Source IGN pas encore publiée")
        m=json.loads(manifest.read_text(encoding="utf8"))
        assert m["schema"]==1 and m["measured"] is True
        assert m["gridSpacingMeters"]==200
        assert m["source"].startswith("IGN")
        assert m["samples"]==m["extent"]["width"]*m["extent"]["height"]
        assert m["validSamples"]>=int(m["samples"]*.96)
        data=(TERRAIN/"elevation.bin").read_bytes()
        assert len(data)==m["samples"]*2
        values=struct.unpack("<"+"h"*m["samples"],data)
        assert sum(x!=-32768 for x in values)==m["validSamples"]
        assert max(values)>min(x for x in values if x!=-32768)

    def test_stable_geometry_no_longer_uses_experimental_draping(self):
        for name in ["buildings.ts","metroOverview.ts",
                     "infrastructure.ts","bridges.ts"]:
            with self.subTest(name=name):
                self.assertNotIn("terrainHeight",
                  (ROOT/"src"/name).read_text(encoding="utf8"))
        main=(ROOT/"src/main.ts").read_text(encoding="utf8")
        self.assertIn("const STABLE_RENDER=true",main)
        self.assertIn("if(!STABLE_RENDER)await terrain.init(ground)",main)
        self.assertIn("new PlaceInspector",main)
        self.assertIn("metro.buildingAt",main)

    def test_place_data_no_false_identity(self):
        code=(ROOT/"src/placeInspector.ts").read_text(encoding="utf8")
        self.assertIn("attribution au bâtiment non certifiée",code)
        self.assertIn("non garantie comme adresse du bâtiment",code)
        self.assertIn("geocodage/reverse",code)
        atlas=ROOT/"public/data/metropole/places/monuments.json"
        if atlas.exists():
            data=json.loads(atlas.read_text(encoding="utf8"))
            self.assertEqual(data["schema"],1)
            self.assertEqual(data["count"],len(data["records"]))
            for item in data["records"]:
                self.assertTrue(item["sourceUrl"].startswith(
                    "https://pop.culture.gouv.fr/notice/merimee/"))

    def test_surface_far_overview_and_near_tiles(self):
        source=(ROOT/"scripts/prepare_surface_tiles.py").read_text(encoding="utf8")
        client=(ROOT/"src/surfaceTiles.ts").read_text(encoding="utf8")
        self.assertIn("overview.json",source)
        self.assertIn("loadOverview()",client)
        self.assertIn("setRoofMode", (ROOT/"src/metroOverview.ts").read_text(encoding="utf8"))
        self.assertIn("setRoofLodEnabled", (ROOT/"src/metroOverview.ts").read_text(encoding="utf8"))
        self.assertIn("identify(x:number,z:number)",client)

if __name__=="__main__":
    unittest.main()
