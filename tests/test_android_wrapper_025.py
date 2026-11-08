"""Préparation du lancement Android natif sans modifier la branche web."""
import json
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
def src(p):return (ROOT/p).read_text(encoding='utf8')
class AndroidBuild(unittest.TestCase):
 def test_capacitor_is_standalone_build(self):
  config=json.loads(src('capacitor.config.json'))
  self.assertEqual(config['webDir'],'dist')
  self.assertEqual(config['appId'],'fr.parisjeu.ville')
  vite=src('vite.config.ts')
  self.assertIn("process.env.CAPACITOR_BUILD === 'true'",vite)
  self.assertIn("'/Paris-le-jeu/'",vite)
 def test_test_apk_has_separate_action(self):
  workflow=src('.github/workflows/android-apk.yml')
  self.assertIn('workflow_dispatch:',workflow)
  self.assertIn('npx cap add android',workflow)
  self.assertIn('assembleDebug',workflow)
  self.assertIn('actions/upload-artifact@v4',workflow)
  self.assertIn('prepare_city_coverage.py',workflow)
  self.assertIn('python -m unittest discover',workflow)
 def test_web_install_is_not_native_claim(self):
  app=src('src/appInstall.ts')
  self.assertIn('export function isNativeApp()',app)
  self.assertIn('Capacitor?.isNativePlatform?.()',app)
  self.assertIn("if(!isNativeApp()&&'serviceWorker' in navigator)",src('src/main.ts'))
if __name__=='__main__':unittest.main()
