"""Contrat par version: au moins une nouvelle fiche indexée sur POP."""
from pathlib import Path
import re,json
ROOT=Path(__file__).resolve().parents[1]
def read(p):return (ROOT/p).read_text(encoding="utf8")
def main():
 p=json.loads(read("data/heritage-release.json"))
 assert p["release"]==json.loads(read("package.json"))["version"],"Mettre à jour le registre de patrimoine pour cette version"
 assert p["requireGrowthEachRelease"] is True
 new=p["newMerimeeReferences"]
 assert len(new)==len(set(new))==p["newCuratedReferenceCount"] and len(new)>0
 pop={x["ref"] for x in json.loads(read("public/data/metropole/places/monuments.json"))["records"]}
 assert len(pop)>=p["minimumOfficialNotices"],"Corpus POP incomplet"
 source=read("src/monumentStories.ts")
 for ref in new:
  assert re.fullmatch(r"PA\d{8}",ref) and ref in pop,"Référence ministérielle non vérifiée: "+ref
  assert ("'"+ref+"'") in source,"Fiche absente: "+ref
 assert len(re.findall(r"'PA\d{8}'\s*:\s*\{",source))>=p["previousCuratedReferenceCount"]+len(new)
 print(p["release"],len(new),"nouvelles fiches sourcées; POP:",len(pop))
if __name__=="__main__":main()
