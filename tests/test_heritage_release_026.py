"""Chaque version ajoute de nouvelles fiches sans inventer les emprises."""
import subprocess,sys,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class HeritageRelease(unittest.TestCase):
 def test_curated_growth_and_sources(self):
  subprocess.run([sys.executable,str(ROOT/"scripts/audit_heritage_releases.py")],
   cwd=ROOT,capture_output=True,text=True,check=True)
 def test_stories_joined_to_public_notice(self):
  text=(ROOT/"src/heritageAtlas.ts").read_text(encoding="utf8")
  self.assertIn("storyForReference(ref)",text)
  self.assertIn("En quelques lignes",text)
if __name__=="__main__":unittest.main()
