"""Garde-fous non destructifs : une seule révision et partie complète."""
from pathlib import Path
import json
import unittest
ROOT=Path(__file__).resolve().parents[1]
def src(path):return (ROOT/path).read_text(encoding='utf-8')

class OrderedRelease(unittest.TestCase):
 def test_revision_declared_and_major_version_blocked(self):
  pkg=json.loads(src('package.json'))
  self.assertEqual(pkg['version'],'0.26.0')
  self.assertIn("REVISION='0.26.0'",src('src/release.ts'))
  self.assertIn("PROTOTYPE='0.26'",src('src/release.ts'))
  self.assertIn('PROTOTYPE 0.26',src('index.html'))
  self.assertIn('id="build-revision"',src('index.html'))
 def test_saved_view_optional_and_restored_after_terrain(self):
  store=src('src/simulation/saveStore.ts')
  camera=src('src/mobileCamera.ts')
  main=src('src/main.ts')
  management=src('src/simulation/ui.ts')
  self.assertIn('view?:GameView',store)
  self.assertIn('if(x.view!==undefined)validateGameView(x.view)',store)
  self.assertIn('captureView(quality:',camera)
  self.assertIn('restoreView(view:GameView)',camera)
  self.assertIn('this.captureView()',management)
  self.assertIn('if(v.view)this.onRestoreView(v.view)',management)
  self.assertIn('if(restoredView!==undefined)camera.restoreView(restoredView)',main)
  self.assertIn("quality.dispatchEvent(new Event('change'))",main)
 def test_atlas_is_solid_but_not_duplicated(self):
  overview=src('src/metroOverview.ts')
  atlas=src('src/cityCoverage.ts')
  self.assertIn('radius>=5000||(this.panoramicAtlas&&radius>4000)',overview)
  self.assertIn('.filter(id=>next.has(id))',overview)
  self.assertIn('this.coverage?.ready&&this.visible.has(group.id)',overview)
  self.assertIn('private applied=false',atlas)
  self.assertIn('this.applied=true',atlas)
  self.assertIn('bâtiments IGN indexés',src('src/main.ts'))
 def test_native_build_tied_to_changes_not_only_manual(self):
  native=src('.github/workflows/android-apk.yml')
  self.assertIn("      - 'src/**'",native)
  self.assertIn('github.run_number',native)
  self.assertIn('assembleDebug',native)

if __name__=='__main__':unittest.main()
