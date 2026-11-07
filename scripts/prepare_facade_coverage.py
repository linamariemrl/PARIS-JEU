#!/usr/bin/env python3
"""État mesurable de la couverture architecturale du 4e arrondissement.

Ne pas confondre segments de contours, façades visibles, observations de façade,
volumes de bâtiment et bâtiments IGN. Cette étape ne phototexture rien.
"""
from __future__ import annotations
import json
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"public/data/4e"
OUT=ROOT/"data/quality/coverage-4e.json"
def read(path):
    return json.loads(path.read_text(encoding="utf-8"))
def build():
    manifest=read(DATA/"manifest.json")
    materials=read(DATA/"materials.json")
    roofs=read(DATA/"roof-shapes.json")
    source_licences=read(ROOT/"data/sources/licences.json")
    buildings={}
    contours=0
    for path in sorted((DATA/"tiles").glob("*.json")):
        chunk=read(path)
        for b in chunk["buildings"]:
            if b["id"] in buildings:
                raise ValueError("Identifiant IGN dupliqué : "+b["id"])
            buildings[b["id"]]=b
            for polygon in b["polygons"]:
                for ring in polygon[:1]:
                    if len(ring)>1:
                        contours+=len(ring)-1 if ring[0]==ring[-1] else len(ring)
    ids=set(buildings)
    assert len(buildings)==manifest["buildings"],"Manifeste et tuiles différents"
    assert len(manifest["tiles"])==len(list((DATA/"tiles").glob("*.json")))
    assert set(materials["byId"]).issubset(ids)
    assert set(roofs["byId"]).issubset(ids)
    assert len(roofs["byId"])==roofs["count"]
    assert materials["totalBuildings"]==len(buildings)
    assert materials["matchedBuildings"]==len(buildings)
    assert all(item["status"]!="utilisé" or item["license"]
               for item in source_licences["sources"])
    number_wall=sum(bool(row.get("wall")) for row in materials["byId"].values())
    number_roof=sum(bool(row.get("roof")) for row in materials["byId"].values())
    number_floor=sum(bool(row.get("floors")) for row in materials["byId"].values())
    assert number_wall==materials["withWallMaterial"]
    assert number_roof==materials["withRoofMaterial"]
    assert number_floor==materials["withFloorCount"]
    return {
      "schema":1,
      "sector":"Paris 4e arrondissement",
      "dataDate":manifest.get("generatedAt"),
      "buildingsIGN":len(buildings),
      "tilesIGN":len(manifest["tiles"]),
      "potentialExteriorContourEdges":contours,
      "potentialExteriorContourEdgesWarning":
        "Ces arêtes d'emprise ne sont PAS nécessairement des façades visibles; murs mitoyens non filtrés.",
      "knownCadastreWallMaterial":number_wall,
      "knownCadastreRoofMaterial":number_roof,
      "knownStoreyCounts":number_floor,
      "OSMRoofShapesMatched":len(roofs["byId"]),
      "OSMRoofHeightsMatched":sum(bool(v.get("height")) for v in roofs["byId"].values()),
      "distinctFacadeRecordsLinkedToStreet":0,
      "photographicallyObservedFacades":0,
      "photographicallyReconstructedFacades":0,
      "unverifiedBuildingAppearance":len(buildings),
      "status":"relevé des sources existantes; chaîne de façades non encore exécutée",
      "nextActions":[
        "joindre géométriquement les volumes de la Ville de Paris aux bâtiments IGN",
        "filtrer arêtes mitoyennes et exposées aux voies",
        "rapprocher périodes/matériaux Apur puis sources photographiques sous licence",
        "conserver un statut observée/reconstituée/inconnue pour chaque façade"
      ]
    }
def main():
    report=build()
    OUT.parent.mkdir(parents=True,exist_ok=True)
    OUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print("Bilan des sources de façades du 4e (sans promesse de photoréalisme) :")
    print(json.dumps(report,ensure_ascii=False,indent=2))
if __name__=="__main__":
    main()
