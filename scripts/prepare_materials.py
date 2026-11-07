#!/usr/bin/env python3
"""Matériaux cadastraux par identifiant IGN, sans fiction ni valeurs inférées.

Les codes MAJIC décrivent la structure déclarée, pas nécessairement le parement
extérieur. Les codes '00', '90', null ou inconnus restent non déterminés.
"""
from __future__ import annotations
from collections import Counter
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urlencode
import json
import re
from prepare_4e import fetch_ign,tile_bounds

ROOT=Path(__file__).resolve().parents[1]
DEST=ROOT/"public/data/4e/materials.json"
TILE_DIR=DEST.parent/"tiles"
BOUNDS=(2.329,48.841,2.382,48.867)
MUR={"1":"pierre","2":"meulière","3":"béton","4":"brique",
      "5":"aggloméré","6":"bois"}
TOIT={"1":"tuile","2":"ardoise","3":"zinc/aluminium","4":"béton"}
CODE=re.compile(r"^[0-9]{2}$")

def material_code(value,wall):
    if value is None: return None
    text=str(value).strip().zfill(2)
    if not CODE.fullmatch(text): return None
    valid=MUR if wall else TOIT
    if not any(ch in valid for ch in text): return None
    return text

def decode(code,wall):
    lookup=MUR if wall else TOIT
    if code is None:return []
    return list(dict.fromkeys(lookup[d] for d in code if d in lookup))

def known_ids():
    out=set()
    for path in TILE_DIR.glob("*.json"):
        data=json.loads(path.read_text(encoding="utf-8"))
        out.update(str(building["id"]) for building in data.get("buildings",[]))
    if len(out)<2000:raise RuntimeError("Bâtiments du 4e introuvables")
    return out

def fetch_features(_bounds):
    # Reprend EXACTEMENT le découpage de l'extraction initiale : 27 petites
    # emprises où le service IGN a déjà répondu de manière fiable.
    manifest=json.loads((DEST.parent/"manifest.json").read_text(encoding="utf-8"))
    if len(manifest.get("tiles",[]))<20:
        raise RuntimeError("Liste des tuiles IGN incomplète")
    for tile in manifest["tiles"]:
        bbox=tile_bounds(tile["ix"],tile["iz"])
        yield from fetch_ign(bbox)

def collect(features,ids):
    known={}
    viewed=set()
    counts=Counter()
    for feature in features:
        props=feature.get("properties") or {}
        ident=str(props.get("cleabs") or feature.get("id") or "")
        if ident not in ids or ident in viewed:continue
        viewed.add(ident)
        wall=material_code(props.get("materiaux_des_murs"),True)
        roof=material_code(props.get("materiaux_de_la_toiture"),False)
        try:
            floors=int(props.get("nombre_d_etages") or 0)
        except (TypeError,ValueError):
            floors=0
        if not 1<=floors<=65:floors=0
        if not wall and not roof and not floors:continue
        row={}
        if wall:row["wall"]=wall;counts["walls"]+=1
        if roof:row["roof"]=roof;counts["roofs"]+=1
        if floors:row["floors"]=floors;counts["floors"]+=1
        known[ident]=row
    if len(viewed)<len(ids)*.78:
        raise RuntimeError(f"Jointure IGN incomplète : {len(viewed)}/{len(ids)} identifiants")
    return known,counts,len(viewed)

def main():
    ids=known_ids()
    records,counts,viewed=collect(fetch_features(BOUNDS),ids)
    if counts["walls"]<300 or counts["roofs"]<300:
        raise RuntimeError(f"Extraction matériaux insuffisante : {counts}")
    report={"schema":1,"source":"IGN BD TOPO v3, attributs fonciers DGFiP/Cerema",
       "sourceUrl":"https://geoservices.ign.fr/bdtopo",
       "codesDocumentation":"https://doc-datafoncier.cerema.fr/doc/ff/pb40_pevprincipale/dmatgm",
       "generatedAt":datetime.now(timezone.utc).isoformat(),
       "totalBuildings":len(ids),"matchedBuildings":viewed,
       "withWallMaterial":counts["walls"],"withRoofMaterial":counts["roofs"],
       "withFloorCount":counts["floors"],
       "limitations":"Matériaux des gros murs fiscaux, pas le parement visible ni la forme du toit.",
       "byId":records}
    DEST.parent.mkdir(parents=True,exist_ok=True)
    tmp=DEST.with_suffix(".tmp")
    tmp.write_text(json.dumps(report,ensure_ascii=False,separators=(",",":")),encoding="utf-8")
    tmp.replace(DEST)
    print(f"IGN: {len(ids)} bâtiments, {viewed} identifiants joints, "
          f"{counts['walls']} murs, {counts['roofs']} toitures, "
          f"{counts['floors']} comptes d'étages.")
    print(f"Taille : {DEST.stat().st_size} octets")
if __name__=="__main__":
    main()
