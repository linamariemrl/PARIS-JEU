"""Couverture des édifices prioritaires et absence de faux rattachement immobilier."""
import json
import re
import unittest
from pathlib import Path
import sys

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/"tests"))
from heritage_swap_contract import function_body
def read(path):
    return (ROOT/path).read_text(encoding="utf8")

class LandmarkInventory026(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog=json.loads(read("public/data/metropole/places/landmark-catalog.json"))
        cls.pop={o["ref"]:o for o in json.loads(
            read("public/data/metropole/places/monuments.json"))["records"]}

    def test_four_categories_have_real_sources(self):
        c=self.catalog
        self.assertEqual(c["schema"],1)
        self.assertEqual(len(c["linked"]),140)
        self.assertGreaterEqual(len(c["pending"]),55)
        roles={"political","touristic","cultural","financial"}
        self.assertEqual({x["role"] for x in c["linked"]+c["pending"]},roles)
        for item in c["linked"]+c["pending"]:
            self.assertIn(item["role"],roles)
            self.assertTrue(item["name"].strip())
            self.assertTrue(item["sourceUrl"].startswith("https://"))
        self.assertIn("non exhaustif",c["scope"])

    def test_exact_pop_ids_not_neighboring_buildings(self):
        corpus=self.catalog["linked"]
        ids=[x["ref"] for x in corpus]
        self.assertEqual(len(ids),len(set(ids)))
        for item in corpus:
            self.assertIn(item["ref"],self.pop)
            self.assertEqual(item["name"],self.pop[item["ref"]]["name"])
            self.assertEqual(item["sourceUrl"],
               "https://pop.culture.gouv.fr/notice/merimee/"+item["ref"])
            self.assertEqual(item["match"],"point-dans-emprise-IGN")
        for item in self.catalog["pending"]:
            self.assertNotIn("ref",item)
            self.assertEqual(item["match"],"emprise-a-confirmer")
        heritage=read("src/heritageAtlas.ts")
        self.assertIn("if(!footprintContains(b,n.x,n.z))continue;",heritage)
        self.assertIn("this.byRef.get(ref)",heritage)

    def test_major_beige_only_and_both_build_pipelines(self):
        buildings=read("src/buildings.ts")
        self.assertEqual(self.catalog["palette"]["major"],"#ded0b9")
        self.assertNotIn("political",self.catalog["palette"])
        for forbidden in ("institutions-orange-pierre","culture-violet-clair",
                          "finances-bleu-pierre","politicalWall","culturalWall",
                          "financialWall"):
            self.assertNotIn(forbidden,buildings)
        self.assertIn("monuments-beige-pierre",buildings)
        for name in ("createTile","createTileProgressive"):
            body=function_body(buildings,name)
            self.assertIn("tileBatches(materials)",body,name)
            self.assertIn("build(scene,tile)",body,name)
            self.assertIn("choose(b)",body,name)
        palette=function_body(buildings,"tileBatches")
        self.assertIn("isMajorHeritageRef(b.heritageRef)",palette)
        self.assertIn("[s.beigeWalls,s.beigeRoofs]",palette)
        self.assertIn("[materials.heritageWall,materials.heritageRoof]",palette)
        priority=read("src/heritagePriorities.ts")
        refs=set(re.findall(r"PA\d{8}",priority))
        self.assertEqual(refs,{x["ref"] for x in self.catalog["linked"]})
        self.assertIn("export function isMajorHeritageRef",priority)

    def test_index_for_all_arrondissements(self):
        idx=json.loads(read("public/data/metropole/places/monuments-paris-index.json"))
        self.assertEqual(idx["schema"],1)
        self.assertEqual(idx["includedCount"],len(idx["entries"]))
        self.assertGreater(idx["includedCount"],140)
        self.assertEqual(set(map(int,idx["byArrondissement"])),set(range(1,21)))
        self.assertEqual(sum(idx["byArrondissement"].values()),idx["includedCount"])
        ids=[e[0] for e in idx["entries"]]
        self.assertEqual(len(ids),len(set(ids)))
        self.assertTrue({r["ref"] for r in self.catalog["linked"]}.issubset(set(ids)))

    def test_index_is_reproducible_from_boundaries(self):
        import runpy
        code=runpy.run_path(str(ROOT/"scripts/prepare_paris_monument_index.py"))
        expected=json.loads(read("public/data/metropole/places/monuments-paris-index.json"))
        self.assertEqual(code["compute"](),expected)

    def test_history_audit_covers_every_paris_notice(self):
        import runpy
        code=runpy.run_path(str(ROOT/"scripts/audit_paris_histories.py"))
        rows=code["audit"]()
        index=json.loads(read("public/data/metropole/places/monuments-paris-index.json"))
        self.assertEqual(sum(v["total"] for v in rows.values()),index["includedCount"])
        self.assertEqual(set(rows),{str(i) for i in range(1,21)})

    def test_catalogue_open_only_on_request(self):
        main=read("src/main.ts")
        index=read("index.html")
        browser=read("src/landmarkBrowser.ts")
        self.assertIn("new LandmarkBrowser(",main)
        self.assertIn("landmarkBrowser.refresh()",main)
        self.assertIn('id="landmark-open"',index)
        self.assertIn('id="landmark-category"',index)
        self.assertIn('id="landmark-list"',index)
        self.assertIn("this.loading=this.load()",browser)
        self.assertIn("entries.slice(0,this.visible)",browser)
        self.assertIn("this.atlas.priorityNotice(item.ref)",browser)
        self.assertNotIn("new Mesh(",browser)
if __name__=="__main__":
    unittest.main()
