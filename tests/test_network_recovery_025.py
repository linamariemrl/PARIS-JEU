"""Reconnexion de l'atlas et des silhouettes IGN sans régression graphique."""
from pathlib import Path
import unittest
ROOT=Path(__file__).resolve().parents[1]
def src(name):return (ROOT/name).read_text(encoding='utf-8')
class NetworkRecovery(unittest.TestCase):
 def test_atlas_retry_avoids_incomplete_scene(self):
  s=src('src/cityCoverage.ts')
  for expected in ["window.addEventListener('online'",'this.initialized=false;','this.applied=false;','this.retryCount<3','if(navigator.onLine)void this.init();','for(const mesh of this.meshes.values())mesh.dispose();','this.showExcept([...this.hidden]);']:
   self.assertIn(expected,s)
 def test_distant_cache_restarts_when_online(self):
  s=src('src/metroOverview.ts')
  for expected in ["window.addEventListener('online',()=>void this.prefetchRaw())",'if(!navigator.onLine)break;','if(connection?.saveData)return','private rawCache=new Map<string,ArrayBuffer>()']:
   self.assertIn(expected,s)
 def test_installation_and_saving_remain_independent(self):
  self.assertIn('id="network-status"',src('index.html'))
  self.assertIn("window.addEventListener('offline',showNetwork)",src('src/appInstall.ts'))
  self.assertIn('id="finance-panel"',src('index.html'))
  self.assertNotIn('new AerialLayer',src('src/main.ts'))
if __name__=='__main__':unittest.main()
