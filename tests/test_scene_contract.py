"""Contrôles sur les invariants du prototype 0.4."""
from pathlib import Path
import json
import unittest

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"public/data/4e"

class SceneInvariants(unittest.TestCase):
    def test_manifest_declare_all_buildings(self):
        manifest=json.loads((DATA/"manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(sum(tile["count"] for tile in manifest["tiles"]),
                         manifest["buildings"])
        self.assertGreaterEqual(manifest["buildings"],2000)

    def test_zoom_does_not_unload_buildings(self):
        code=(ROOT/"src/tileManager.ts").read_text(encoding="utf-8")
        self.assertIn("await Promise.all([worker(), worker(), worker()])",code)
        self.assertIn("setQuality(quality:",code)
        self.assertIn("update(x:number,z:number)",code)
        self.assertNotIn("loaded.meshes.forEach(mesh => mesh.dispose())",code)
        self.assertIn("mesh.name.startsWith('batiments-cornice-')",code)
        self.assertIn("mesh.setEnabled(detail)",code)
        # Seuls les couronnements illustratifs sont masqués selon les LOD ;
        # les maillages de bâtiments et le compteur restent inchangés.
        self.assertIn("const meshes=createTile(this.scene,data,this.materials)",code)

    def test_street_labels_use_real_world_geometry(self):
        code=(ROOT/"src/streetLabels.ts").read_text(encoding="utf-8")
        geometry=(ROOT/"src/streetLabelGeometry.ts").read_text(encoding="utf-8")
        self.assertIn("quadOnRoad(label,",code)
        self.assertIn("VertexBuffer.PositionKind",code)
        self.assertIn("disableDepthWrite=true",code)
        self.assertNotIn("canvas.getContext",code)
        self.assertNotIn("ctx.translate(x,y)",code)
        self.assertNotIn("this.canvas.clientWidth",code)
        self.assertIn("mesh.updateVerticesData",code)
        self.assertIn("a.x-vx*halfW-nx*halfH",geometry)

    def test_all_official_street_names_have_label(self):
        file=DATA/"street-names.json"
        if not file.exists():
            self.skipTest("Génération des voies officielles non encore effectuée")
        data=json.loads(file.read_text(encoding="utf-8"))
        self.assertEqual(data["officialCount"],data["namedStreets"])
        self.assertGreaterEqual(len(data["labels"]),data["namedStreets"])
        if any("streetId" in item for item in data["labels"]):
            self.assertEqual(
                len({item["streetId"] for item in data["labels"]}),
                data["namedStreets"]
            )
        self.assertEqual(len({x["id"] for x in data["labels"]}),len(data["labels"]))
        self.assertGreaterEqual(data["namedStreets"],150)


    def test_sources_architecturales_liees_aux_identifiants_ign(self):
        material_path=DATA/"materials.json"
        roof_path=DATA/"roof-shapes.json"
        if not material_path.exists() or not roof_path.exists():
            self.skipTest("Les extractions officielles n'ont pas encore été produites")
        ids={
            b["id"]
            for p in (DATA/"tiles").glob("*.json")
            for b in json.loads(p.read_text(encoding="utf-8"))["buildings"]
        }
        self.assertEqual(len(ids),2696)
        materials=json.loads(material_path.read_text(encoding="utf-8"))
        self.assertEqual(materials["totalBuildings"],len(ids))
        self.assertEqual(materials["matchedBuildings"],len(ids))
        self.assertTrue(set(materials["byId"]).issubset(ids))
        self.assertGreaterEqual(materials["withWallMaterial"],1000)
        self.assertGreaterEqual(materials["withRoofMaterial"],1000)
        for record in materials["byId"].values():
            for name in ("wall","roof"):
                if name in record:
                    self.assertRegex(record[name],r"^[0-9]{2}$")
        roof=json.loads(roof_path.read_text(encoding="utf-8"))
        self.assertEqual(roof["count"],len(roof["byId"]))
        self.assertTrue(set(roof["byId"]).issubset(ids))
        self.assertTrue(all(v["score"]>=.63 for v in roof["byId"].values()))
        self.assertGreaterEqual(roof["count"],40)

if __name__=="__main__":
    unittest.main()
