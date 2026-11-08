"""Contrats des quartiers administratifs : données, gestes et rendu Android."""
import json
import unittest
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
def read(path):
    return (ROOT/path).read_text(encoding="utf8")

class QuarterSelection026(unittest.TestCase):
    def test_quarter_source_is_independent_from_streets(self):
        script=read("scripts/prepare_urban_history.py")
        self.assertLess(script.index("quarters=prepare_quarters()"),
                        script.index("for f in download(SOURCES[\"streets\"])"))
        self.assertIn('OUTPUT.with_name("quarters.json")',script)
        self.assertIn("len(quarters)!=80",script)
        urban=read("src/urbanAtlas.ts")
        self.assertIn("'data/metropole/places/quarters.json'",urban)
        self.assertIn("quarterAt(x:number,z:number)",urban)
        self.assertIn("this.quarters.length===80",urban)

    def test_quarter_input_and_very_light_overlay(self):
        index=read("index.html")
        main=read("src/main.ts")
        for element in ["quarter-mode","quarter-tools","quarter-pick","quarter-hint"]:
            self.assertIn('id="'+element+'"',index)
            self.assertIn("'"+element+"'",main)
        self.assertIn("if(quarterMode)",main)
        self.assertIn("quarterOverlay.show(quarter)",main)
        self.assertIn("quarterOverlay.clear()",main)
        self.assertIn("management?.setSelection({id:'quartier:'",main)
        overlay=read("src/quarterSelection.ts")
        self.assertIn("mat.alpha=.18",overlay)
        self.assertIn("mat.disableDepthWrite=true",overlay)
        self.assertIn("mesh.isPickable=false",overlay)
        self.assertIn("appendDraped(",overlay)
        self.assertIn("terrainHeight",overlay)
        self.assertNotIn("requestAnimationFrame",overlay)
        self.assertIn("if(this.current===quarter)return",overlay)

    def test_builders_fail_if_80_boundaries_missing(self):
        for path in [".github/workflows/build.yml",
                     ".github/workflows/deploy.yml",
                     ".github/workflows/android-apk.yml"]:
            self.assertIn("test -s public/data/metropole/places/quarters.json",
                          read(path))

    def test_official_data_if_generated(self):
        path=ROOT/"public/data/metropole/places/quarters.json"
        if not path.exists():
            self.skipTest("Contours officiels générés dans les workflows CI")
        doc=json.loads(path.read_text(encoding="utf8"))
        self.assertEqual(doc["schema"],1)
        self.assertEqual(len(doc["quarters"]),80)
        ids={(q["arr"],q["name"]) for q in doc["quarters"]}
        self.assertEqual(len(ids),80)
        for q in doc["quarters"]:
            self.assertTrue(1<=q["arr"]<=20)
            self.assertTrue(q["polygons"])
            self.assertTrue(all(len(ring)>=4 for poly in q["polygons"]
                                for ring in poly))
if __name__=="__main__":
    unittest.main()
