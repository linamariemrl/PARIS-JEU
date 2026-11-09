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

    def test_palette_and_both_build_pipelines(self):
        b=read("src/buildings.ts")
        for x in ["monuments-beige-pierre","institutions-orange-pierre",
                  "culture-violet-clair","finances-bleu-pierre"]:
            self.assertIn(x,b)
        # Les deux chaînes de construction (4e synchrone, métropole
        # progressive) passent par la même palette et les mêmes lots.
        for name in ("createTile","createTileProgressive"):
            body=function_body(b,name)
            self.assertIn("tileBatches(materials)",body,name)
            self.assertIn("build(scene,tile)",body,name)
            self.assertIn("choose(b)",body,name)
        palette=function_body(b,"tileBatches")
        for pair in ["['wall',s.walls,materials.wall]","['roof',s.roofs,materials.roof]",
                     "['wall',s.beigeWalls,materials.heritageWall]",
                     "['roof',s.beigeRoofs,materials.heritageRoof]",
                     "['wall',s.orangeWalls,materials.politicalWall]",
                     "['roof',s.orangeRoofs,materials.politicalRoof]",
                     "['wall',s.violetWalls,materials.culturalWall]",
                     "['roof',s.violetRoofs,materials.culturalRoof]",
                     "['wall',s.blueWalls,materials.financialWall]",
                     "['roof',s.blueRoofs,materials.financialRoof]"]:
            self.assertEqual(palette.count(pair),1,pair)
        # Lots fusionnés ET maillages séparés des monuments : même rôle,
        # même couleur (aucun monument ne change de teinte en étant isolé).
        self.assertEqual(palette.count("b.heritageRole==='cultural'"),2)
        self.assertIn("[materials.culturalWall,materials.culturalRoof]",palette)
        self.assertIn("[s.violetWalls,s.violetRoofs]",palette)
        categories=read("src/heritageCategories.ts")
        self.assertIn("priorityHeritageRole(ref)",categories)
        self.assertIn("return 'touristic'",categories)
        refs=read("src/heritagePriorities.ts")
        actual=set(re.findall(r"PA\d{8}",refs))
        self.assertEqual(actual,{x["ref"] for x in self.catalog["linked"]})
        # La Bourse de Commerce, lieu d'exposition, n'est plus présentée
        # comme une place boursière en activité.
        self.assertEqual(next(x["role"] for x in self.catalog["linked"]
                              if x["ref"]=="PA00085784"),"cultural")

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
