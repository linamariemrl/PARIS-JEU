#!/usr/bin/env python3
"""Arbres du 4e arrondissement : positions et hauteurs publiées par la Ville.

Source : Paris Data, « les-arbres », ODbL. Cette donnée n'est ni exhaustive
ni actualisée en temps réel. Ne produit jamais de positions fictives.
"""
from __future__ import annotations
import json
import math
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
DEST = ROOT / "public" / "data" / "4e" / "trees.json"
URL = "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/les-arbres/records"
LON = 2.3537
LAT = 48.8545
MX = 111320 * math.cos(math.radians(LAT))
MZ = 111132
FILTER = 'arrondissement="PARIS 4E ARRDT"'
MAX_ROWS = 6000
LIMIT = 100

def read_json(url: str) -> dict:
    last = None
    for attempt in range(4):
        try:
            req = Request(url, headers={
                "User-Agent": "PARIS-city-game/0.3 (GitHub Actions; non-commercial)",
                "Accept": "application/json",
            })
            with urlopen(req, timeout=50) as response:
                data = json.load(response)
            if not isinstance(data, dict):
                raise ValueError("Réponse Paris Data invalide")
            return data
        except (HTTPError, URLError, TimeoutError, ValueError, OSError) as exc:
            last = exc
            time.sleep(1 + 2 ** attempt)
    raise RuntimeError("Paris Data indisponible : " + str(last))

def extract_tree(row: dict):
    point = row.get("geo_point_2d")
    if not isinstance(point, dict):
        return None
    try:
        lon = float(point["lon"])
        lat = float(point["lat"])
    except (ValueError, TypeError, KeyError):
        return None
    if not (2.32 < lon < 2.40 and 48.83 < lat < 48.88):
        return None
    if str(row.get("arrondissement", "")).upper() != "PARIS 4E ARRDT":
        return None
    ident = row.get("idbase")
    if ident is None:
        return None
    try:
        h = float(row.get("hauteurenm") or 0)
    except (TypeError, ValueError):
        h = 0
    estimated = not math.isfinite(h) or not 2 <= h <= 38
    if estimated:
        h = 8.0
    try:
        circ = float(row.get("circonferenceencm") or 0)
    except (TypeError, ValueError):
        circ = 0
    return {
        "id": str(ident),
        "x": round((lon - LON) * MX, 2),
        "z": round((lat - LAT) * MZ, 2),
        "h": round(h, 1),
        "estimated": estimated,
        "genre": str(row.get("genre") or ""),
        "domain": str(row.get("domanialite") or ""),
        "circumference": round(circ, 1) if 0 <= circ <= 900 else 0,
    }

def extract(rows):
    trees = []
    seen = set()
    for row in rows:
        tree = extract_tree(row)
        if tree is None or tree["id"] in seen:
            continue
        seen.add(tree["id"])
        trees.append(tree)
    return trees

def main():
    output = []
    seen = set()
    total = None
    for offset in range(0, MAX_ROWS, LIMIT):
        params = {"where": FILTER, "limit": LIMIT, "offset": offset}
        data = read_json(URL + "?" + urlencode(params))
        rows = data.get("results")
        if not isinstance(rows, list):
            raise RuntimeError("Enregistrements d'arbres absents")
        if total is None:
            total = int(data.get("total_count", 0))
            if not 200 <= total <= MAX_ROWS:
                raise RuntimeError(f"Volume d'arbres du 4e inattendu : {total}")
        for tree in extract(rows):
            if tree["id"] not in seen:
                output.append(tree)
                seen.add(tree["id"])
        if offset + len(rows) >= total:
            break
        time.sleep(0.12)
    if total is None or len(output) < min(200, total * .5):
        raise RuntimeError(f"Extraction Paris Data suspecte : {len(output)} / {total}")
    output.sort(key=lambda t: t["id"])
    payload = {
        "schema": 1,
        "source": "Ville de Paris, Paris Data : les-arbres",
        "sourceUrl": "https://opendata.paris.fr/explore/dataset/les-arbres/",
        "license": "ODbL",
        "extractedAt": datetime.now(timezone.utc).isoformat(),
        "complete": False,
        "count": len(output),
        "trees": output,
    }
    DEST.parent.mkdir(parents=True, exist_ok=True)
    tmp = DEST.with_suffix(".tmp")
    tmp.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    tmp.replace(DEST)
    print(f"Arbres géolocalisés : {len(output)} (enregistrements : {total}); "
          f"fichier : {DEST.stat().st_size} octets.")

if __name__ == "__main__":
    main()
