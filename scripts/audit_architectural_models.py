#!/usr/bin/env python3
"""Audit strict de l'inventaire et des maquettes métriques publiées.

Sans plan coté interprété, sans preuve géoréférencée et sans contrôle, un
modèle ne doit pas être chargé ni déclaré conforme. L'index vide est valide :
il conserve l'IGN existant en attendant de vraies maquettes mesurées.
"""
from pathlib import Path
from urllib.parse import urlsplit
import json, math, re

ROOT=Path(__file__).resolve().parents[1]
HERE=ROOT/"public/data/metropole/architecture"
DOC=HERE/"dossiers.json"
INDEX=HERE/"models/index.json"
LANDMARKS=ROOT/"public/data/metropole/places/landmark-catalog.json"
CORE={"archives-paris","mpp","gallica","capa","ign-lidar","paris-data"}

def load(path):
    return json.loads(path.read_text(encoding="utf-8"))

def validate():
    docs=load(DOC)
    places=load(LANDMARKS)
    models=load(INDEX)
    assert docs["schema"]==1 and models["schema"]==1
    portals={p["id"]:p for p in docs["sourcePortals"]}
    assert set(portals)==CORE, "Les six portails exigés doivent figurer"
    for portal in portals.values():
        assert urlsplit(portal["url"]).scheme=="https"
    library=docs["dossiers"]
    assert len(library)==len(places["linked"])+len(places["pending"])>=190
    assert len({d["id"] for d in library})==len(library)
    indexed={d["ref"]:d for d in library if d["ref"]}
    official={d["ref"]:d for d in places["linked"]}
    assert set(indexed)==set(official)
    researched=0
    for ref,dossier in indexed.items():
        assert dossier["name"]==official[ref]["name"]
        assert dossier["sourceNotice"]==official[ref]["sourceUrl"]
        assert dossier["geometry"]=="emprise-et-volumes-ign-seulement" or dossier["publicationAllowed"]
        assert isinstance(dossier["uncertainty"],list)
        assert dossier["publicationAllowed"] is False or dossier["geometry"]=="modele-mesure-verifie"
        sources={s["id"]:s for s in dossier["documents"]}
        assert len(sources)==len(dossier["documents"])
        for source in sources.values():
            assert urlsplit(source["url"]).scheme=="https"
            assert source["type"] and source["title"] and source["portalId"]
            assert source["notes"]
        for measure in dossier["measurements"]:
            assert measure["sourceId"] in sources
            assert measure["unit"]=="m"
            assert isinstance(measure["value"],(float,int)) and math.isfinite(measure["value"])
            assert measure["value"]>0 and measure["precision"]
        if dossier["phase"]!="recherche-de-plans-a-faire":
            assert sources,"Un plan revendiqué doit avoir des sources"
            researched+=1
    assert researched>=4
    hotel=indexed["PA00086319"]
    assert hotel["phase"]=="plans-d-execution-localises"
    assert len(hotel["documents"])>=6
    assert len(hotel["measurements"])==0, "Les feuilles du dessin ne sont pas des cotes bâties"
    assert {"bhdv-cc64-pl34","bhdv-cc16-pl39","bhdv-cc76-pl04"}.issubset(
        {s["id"] for s in hotel["documents"]})
    eiffel=indexed["PA00088801"]
    measures={m["element"]:m["value"] for m in eiffel["measurements"]}
    assert measures["Hauteur totale actuelle"]==330
    assert measures["Largeur totale au sol"]==125

    published=models["models"]
    assert isinstance(published,list) and len(published)<=195
    assert len({m["ref"] for m in published})==len(published)
    total_triangles=0
    for model in published:
        ref=model["ref"]
        assert ref in indexed and indexed[ref]["publicationAllowed"] is True
        assert model["review"]=="measured-and-approved"
        assert model["fullReplacement"] is True
        assert math.isfinite(model["x"]) and math.isfinite(model["z"])
        sources=set(s["id"] for s in indexed[ref]["documents"])
        assert model["sourceIds"] and set(model["sourceIds"])<=sources
        assert model["lods"] and len(model["lods"])<=3
        tiers=set()
        for lod in model["lods"]:
            assert lod["tier"] in ("high","medium","low") and lod["tier"] not in tiers
            tiers.add(lod["tier"])
            assert lod["file"]==ref+"-"+lod["tier"]+".json"
            assert isinstance(lod["maxRadiusMeters"],(float,int))
            assert 100<=lod["maxRadiusMeters"]<=6000
            asset=load(HERE/"models"/lod["file"])
            assert asset["schema"]==1 and asset["ref"]==ref
            assert asset["tier"]==lod["tier"]
            assert asset["units"]=="m" and asset["coordinates"]=="paris-local-xyz"
            assert asset["sourceIds"] and set(asset["sourceIds"])<=set(model["sourceIds"])
            assert 1<=len(asset["parts"])<=400
            vertices=triangles=0
            for part in asset["parts"]:
                assert part["kind"] in {"wall","roof","detail"}
                assert part["sourceIds"] and set(part["sourceIds"])<=set(asset["sourceIds"])
                xyz,indices=part["positions"],part["indices"]
                assert len(xyz)>=9 and len(xyz)%3==0
                assert len(indices)>=3 and len(indices)%3==0
                assert all(isinstance(v,(float,int)) and math.isfinite(v) and
                    abs(v)<85000 for v in xyz)
                assert all(type(i) is int and 0<=i<len(xyz)//3 for i in indices)
                vertices+=len(xyz)//3
                triangles+=len(indices)//3
            assert 40<=triangles<=300000 and vertices<=180000
            total_triangles+=triangles
    return {"dossiers":len(library),"researched":researched,
            "published_models":len(published),"lod_triangles":total_triangles}

if __name__=="__main__":
    report=validate()
    print("Audit des maquettes monumentales :",report)
