"""Régressions structurelles : disparition de tuiles et scintillement 3D."""
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[1]


class ContinuityInvariants(unittest.TestCase):
    def test_lod_gpu_buffers_are_updateable(self):
        code=(ROOT/"src/metroOverview.ts").read_text(encoding="utf-8")
        self.assertIn("mesh.thinInstanceSetBuffer('matrix',matrices,16,false)",code)
        self.assertIn("setDetailed(id:string,enabled:boolean)",code)
        self.assertIn("oriented-box-approximation",code)
        self.assertNotIn("thinInstanceSetBuffer('matrix',matrices,16,true)",code)

    def test_exact_meshes_are_prepared_without_hard_render_loop_stalls(self):
        geometry=(ROOT/"src/buildings.ts").read_text(encoding="utf-8")
        streamed=(ROOT/"src/metroTiles.ts").read_text(encoding="utf-8")
        self.assertIn("requestAnimationFrame",geometry)
        self.assertIn("createTileProgressive",streamed)
        self.assertIn("this.overview?.setDetailed(tile.id,true)",streamed)
        self.assertIn("this.overview?.setDetailed(id,false)",streamed)
        self.assertIn("this.tileCache",streamed)
        self.assertNotIn("this.active.delete(id);",streamed.split("private makeRoom")[0])

    def test_camera_has_proportional_near_clip_plane(self):
        code=(ROOT/"src/mobileCamera.ts").read_text(encoding="utf-8")
        self.assertIn("clamp(this.camera.radius/60,.15,380)",code)
        self.assertIn("this.camera.maxZ=65000",code)

if __name__=="__main__":
    unittest.main()
