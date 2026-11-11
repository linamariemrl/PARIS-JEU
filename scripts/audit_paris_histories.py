#!/usr/bin/env python3
"""Audit R09 des fiches POP parisiennes : présence de champs, sans invention."""
from __future__ import annotations
import json,re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
INDEX=ROOT/"public/data/metropole/places/monuments-paris-index.json"
SOURCE=ROOT/"public/data/metropole/places/monuments.json"
STORIES=ROOT/"src/monumentStories.ts"
def audit():
    idx=json.loads(INDEX.read_text(encoding="utf8"))
    pop={r["ref"]:r for r in json.loads(SOURCE.read_text(encoding="utf8"))["records"]}
    authored=set(re.findall(r"['\"](PA\d{8})['\"]\s*:",STORIES.read_text(encoding="utf8")))
    rows={str(n):{"total":0,"dated":0,"sourceDescription":0,
        "idStory":0,"withoutDateDescriptionIdStory":0} for n in range(1,21)}
    for ref,arr,name in idx["entries"]:
        rec=pop[ref]
        row=rows[str(arr)]
        row["total"]+=1
        date=bool(rec.get("date","").strip())
        desc=bool(rec.get("description","").strip())
        story=ref in authored
        row["dated"]+=int(date)
        row["sourceDescription"]+=int(desc)
        row["idStory"]+=int(story)
        row["withoutDateDescriptionIdStory"]+=int(not(date or desc or story))
    assert sum(v["total"] for v in rows.values())==idx["includedCount"]
    return rows
if __name__=="__main__":
    rows=audit()
    for arr,vals in rows.items():
        print(arr+"e : "+str(vals))
