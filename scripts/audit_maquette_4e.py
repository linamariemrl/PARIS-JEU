#!/usr/bin/env python3
"""Audit géométrique reproductible avant extension du 4e à tout Paris.

Ne crée ni immeubles, ni hauteurs, ni toitures. Mesure la couverture effective
des données publiques déjà chargées dans le simulateur.
"""
from __future__ import annotations
import json
from collections import Counter
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
DATA=ROOT/"public/data/4e"
OUTPUT=ROOT/"data/quality/maquette-4e.json"

def load(path:Path):
    return json.loads(path.read_text(encoding="utf-8"))

def audit():
    manifest=load(DATA/"manifest.json")
    roofs=load(DATA/"roof-shapes.json")
    volumes=load(DATA/"city-volumes.json")
    materials=load(DATA/"materials.json")
    ids=set()
    heights=[]
    samples=Counter()
    rings=0
    vertices=0
    for tile in manifest["tiles"]:
        path=DATA/"tiles"/(tile["id"]+".json")
        doc=load(path)
        if doc["schema"]!=1 or doc["id"]!=tile["id"]:
            raise ValueError("Tuile IGN incohérente : "+tile["id"])
        if len(doc["buildings"])!=tile["count"]:
            raise ValueError("Nombre de bâtiments incohérent : "+tile["id"])
        for b in doc["buildings"]:
            ident=b["id"]
            if ident in ids:raise ValueError("Bâtiment IGN dupliqué : "+ident)
            ids.add(ident)
            if b["height"]<=0:raise ValueError("Hauteur invalide : "+ident)
            heights.append(float(b["height"]))
            samples["heightEstimated" if b.get("estimatedHeight") else "heightMeasured"]+=1
            if not b["polygons"]:raise ValueError("Bâtiment vide : "+ident)
            for polygon in b["polygons"]:
                if not polygon or not polygon[0] or len(polygon[0])<4:
                    raise ValueError("Emprise incomplète : "+ident)
                for ring in polygon:
                    rings+=1
                    vertices+=len(ring)
    if len(ids)!=manifest["buildings"]:
        raise ValueError("Le modèle ne contient pas tous les bâtiments IGN")
    if not set(roofs["byId"]).issubset(ids) or not set(volumes["byId"]).issubset(ids):
        raise ValueError("Bâtiments associés qui n'existent pas dans l'IGN")
    eligible={
        ident for ident,g in volumes["byId"].items()
        if g.get("coverage",0)>=.9
        and g.get("coverage",0)<=1.01
        and len(g.get("parts",[]))>=2
        and ident not in roofs["byId"]
    }
    documentedRoof=set(roofs["byId"])
    report={
      "schema":1,
      "region":"Paris, 4e arrondissement",
      "renderer":"maquette 3D monochrome Babylon.js",
      "source":"IGN BD TOPO, Ville de Paris Volumes bâtis, OpenStreetMap",
      "tileCount":len(manifest["tiles"]),
      "buildingCount":len(ids),
      "polygonRings":rings,
      "ringCoordinates":vertices,
      "heightMeasuredCount":samples["heightMeasured"],
      "heightEstimatedCount":samples["heightEstimated"],
      "minimumIGNHeightMeters":min(heights),
      "maximumIGNHeightMeters":max(heights),
      "cityVolumesInSource":volumes["officialVolumes"],
      "cityVolumeMatches":volumes["matchedBuildings"],
      "eligibleRefinedBuildings":len(eligible),
      "eligibleRefinedParts":sum(len(volumes["byId"][ident]["parts"]) for ident in eligible),
      "roofsWithDocumentedShape":len(documentedRoof),
      "roofsWithDocumentedHeight":roofs["heightKnown"],
      "roofsWithoutDocumentedShape":len(ids-documentedRoof),
      "materials": {
        "wallMaterialDeclarations":materials["withWallMaterial"],
        "roofMaterialDeclarations":materials["withRoofMaterial"]
      },
      "limitations":[
        "Les formes de couverture manquantes nécessitent LiDAR HD, pas une extrapolation visuelle",
        "Les subdivisions bâties ont des contours mesurés, mais leur hauteur intermédiaire est estimée",
        "La hauteur des ponts et certaines largeurs de chaussée restent schématiques",
        "Une orthophoto ne permet pas de reconstruire une façade ni une toiture 3D"
      ],
      "nextDataSteps":[
        "Télécharger les dalles LiDAR HD limitées au 4e, préparer hors navigateur et comparer par identifiant IGN",
        "Associer un niveau de confiance à chaque toit et vérifier les raccords entre parties de bâtiments",
        "Obtenir les 20 limites d'arrondissements et calculer les communes limitrophes par ADMIN EXPRESS",
        "Étendre l'index des tuiles sans téléchargement de tout Paris sur un téléphone",
        "Construire l'état de simulation et les sauvegardes à l'étape 4"
      ]
    }
    if report["buildingCount"]!=2696:
        raise AssertionError("Changement non autorisé du périmètre IGN du 4e")
    if report["roofsWithDocumentedShape"]<40:
        raise AssertionError("Perte des formes OSM")
    return report

if __name__=="__main__":
    report=audit()
    OUTPUT.parent.mkdir(parents=True,exist_ok=True)
    OUTPUT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps(report,ensure_ascii=False,indent=2))
