#!/usr/bin/env python3
"""Atlas permanent de la couverture des bâtiments IGN, destiné au mobile.

Toutes les enveloppes du manifeste officiel participent au calcul, sans
perte dans l'effectif. Des cellules de 50 m produisent une silhouette
compacte de présence bâtie; ce n'est PAS un dessin de chaque empreinte.
Les tuiles détaillées continuent d'utiliser les vraies géométries.
Format binaire: int16 centre x,z (m), uint8 côté (m), uint8 hauteur
(m), uint16 effectif IGN = 8 octets par cellule.
"""
from __future__ import annotations
import json
import math
import struct
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
SOURCE=ROOT/"public/data/metropole/overview"
DEST=ROOT/"public/data/metropole/coverage"
CELL=50
S=struct.Struct("<hhBBH")

def generate():
    doc=json.loads((SOURCE/"manifest.json").read_text(encoding="utf8"))
    if doc.get("schema")!=2 or doc.get("tileMeters")!=800 or doc.get("cellsPerGroup")!=4:
        raise ValueError("Métadonnées IGN incompatibles avec l'atlas")
    DEST.mkdir(parents=True,exist_ok=True)
    output={"schema":1,"cellMeters":CELL,
            "totalBuildings":doc["totalBuildings"],
            "sourceHash":doc.get("sourceHash",""),"representation":"aggregated-50m-cells",
            "groups":[]}
    total=0
    for group in doc["groups"]:
        payload=(SOURCE/(group["id"]+".bin")).read_bytes()
        if len(payload)!=group["count"]*12:raise ValueError("Bloc IGN endommagé")
        cells={}
        for tile in group["tiles"]:
            for i in range(tile["offset"],tile["offset"]+tile["count"]):
                cx,cz,w,d,h,_=struct.unpack_from("<hhHHHh",payload,i*12)
                x=tile["ix"]*800+cx*.25
                z=tile["iz"]*800+cz*.25
                gx,gz=math.floor(x/CELL),math.floor(z/CELL)
                entry=cells.setdefault((gx,gz),[0,0.0,0.0,0.0])
                entry[0]+=1
                entry[1]+=min(CELL*CELL,w*d*.25*.25)
                entry[2]+=max(2,h*.25)
                entry[3]=max(entry[3],h*.25)
        data=bytearray()
        count=0
        for (gx,gz),(n,area,heights,maximum) in sorted(cells.items()):
            x=round((gx+.5)*CELL)
            z=round((gz+.5)*CELL)
            # Maillage agrégé = approximation de présence bâtie, pas emprise IGN.
            side=max(4,min(48,round(math.sqrt(area)*.9)))
            height=max(2,min(255,round(min(maximum,heights/n+12))))
            if n>65535 or abs(x)>32767 or abs(z)>32767:
                raise ValueError("Cellule hors du format géographique")
            data.extend(S.pack(x,z,side,height,n))
            count+=n
        if count!=group["count"]:raise ValueError("Effectif groupe incomplet")
        total+=count
        (DEST/(group["id"]+".bin")).write_bytes(data)
        output["groups"].append({"id":group["id"],"cells":len(cells),
                                 "buildings":count,"bytes":len(data)})
    if total!=doc["totalBuildings"]:raise ValueError("Atlas non exhaustif")
    (DEST/"manifest.json").write_text(
        json.dumps(output,ensure_ascii=False,separators=(",",":"))+"\n",
        encoding="utf8")
    print(f"Atlas IGN : {total} bâtiments inclus en "
          f"{sum(g['cells'] for g in output['groups'])} cellules, "
          f"{sum(g['bytes'] for g in output['groups'])/1e6:.2f} Mo")

if __name__=="__main__":generate()
