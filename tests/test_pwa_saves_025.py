"""Contrats PWA Android : sauvegardes, installation et versions figées."""
from pathlib import Path
import json
import unittest
ROOT=Path(__file__).resolve().parents[1]
def source(p):return (ROOT/p).read_text(encoding='utf8')
class PwaSaves(unittest.TestCase):
 def test_installation_and_update_control(self):
  html=source('index.html')
  for id in ['install-app','persist-data','update-app','app-install-status',
             'save-export-all','autosave-status']:
   self.assertIn('id="'+id+'"',html)
  install=source('src/appInstall.ts')
  for key in ['beforeinstallprompt','appinstalled','storage.persist()',
              'display-mode: standalone']:
   self.assertIn(key,install)
  self.assertIn("registerType: 'prompt'",source('vite.config.ts'))
  self.assertIn('onNeedRefresh:',source('src/main.ts'))
 def test_autosaves_and_bundle_validation(self):
  ui=source('src/simulation/ui.ts')
  for key in ['private restored=false','private writing=false',
              'paris.activeSlot','visibilitychange','pagehide',
              'this.lastAutosave>=30000','validateBundle(parsed)',
              'private async exportAll()']:
   self.assertIn(key,ui)
  save=source('src/simulation/saveStore.ts')
  for key in ['export function validateBundle','b.saves.length>30',
              'ids.has(item.slot)','validateSave(item.save)']:
   self.assertIn(key,save)
  self.assertTrue(json.loads(source('package.json'))['version'].startswith('0.26.'))
if __name__=='__main__':unittest.main()
