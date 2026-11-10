#!/usr/bin/env python3
"""R09 : notices POP officielles des édifices de Paris (découverte + vérification).

Deux étapes, reproductibles et idempotentes :

1. **Découverte** (`--discover`) : liste des identifiants Mérimée (P380) que
   Wikidata situe à Paris (P131* Q90). Wikidata ne sert QU'À découvrir des
   références : aucune donnée descriptive n'en est reprise.
2. **Vérification** : chaque référence (index parisien du jeu + découverte)
   est lue sur l'API officielle POP v2 du ministère de la Culture
   (`api.pop.culture.gouv.fr/notices/merimee/<REF>`, licence Etalab 2.0).
   Une notice n'est retenue que si POP la situe à Paris (commune, code INSEE
   751xx ou département 75). Les réponses brutes sont mises en cache hors du
   dépôt (`data/cache/pop/`) ; seuls les champs utiles sont publiés.

Sorties :
- public/data/metropole/places/sources/wikidata-merimee-paris.json
- data/heritage/pop-notices-paris.json (hors site publié)

Usage : python scripts/fetch_pop_notices.py [--discover] [--limit N] [--delay S]
"""
from __future__ import annotations

import argparse
import json
import re
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLACES = ROOT / 'public/data/metropole/places'
INDEX = PLACES / 'monuments-paris-index.json'
DISCOVERY = PLACES / 'sources/wikidata-merimee-paris.json'
OUT = ROOT / 'data/heritage/pop-notices-paris.json'
CACHE = ROOT / 'data/cache/pop'
API = 'https://api.pop.culture.gouv.fr/notices/merimee/'
UA = 'PARIS-le-jeu-inventaire/0.2 (https://github.com/meyameya677-sketch/Paris-le-jeu)'
REF = re.compile(r'^[A-Z]{2,3}[0-9A-Z]{3,9}$')

# Champs POP conservés (dictionnaire Mérimée).
FIELDS = {
    'TICO': 'titre', 'DENO': 'denominations', 'DOMN': 'domaines',
    'SCLE': 'siecles', 'DATE': 'dates', 'JDAT': 'justificationDates',
    'AUTR': 'auteurs', 'HIST': 'historique', 'DESC': 'description',
    'PROT': 'protection', 'DPRO': 'datesProtection', 'PPRO': 'precisionProtection',
    'LABEL': 'label', 'STAT': 'statutProprietaire', 'AFFE': 'affectataire',
    'ADRS': 'adresse', 'WADRS': 'adresseNormalisee', 'COM': 'communes',
    'INSEE': 'insee', 'SITE': 'zonesProtegees', 'OBS': 'observations',
    'PINT': 'precisionsInteret', 'LIENS': 'liens', 'DMAJ': 'miseAJour',
    'ETUD': 'cadreEtude', 'DOSS': 'typeDossier', 'APPL': 'appellations',
    'PDEN': 'precisionDenomination', 'ETAT': 'etat', 'VOCA': 'vocable',
}


def get(url: str, timeout: int = 60) -> tuple[int, bytes]:
    r = subprocess.run(['curl', '-s', '-w', '\n%{http_code}', '--max-time', str(timeout),
                        '-H', 'User-Agent: ' + UA, url], capture_output=True)
    body, _, code = r.stdout.rpartition(b'\n')
    return (int(code or 0), body)


def discover() -> dict:
    query = ('SELECT ?item ?mer WHERE { ?item wdt:P380 ?mer . '
             '?item wdt:P131* wd:Q90 . }')
    r = subprocess.run(['curl', '-s', '--max-time', '180', '-G',
                        'https://query.wikidata.org/sparql',
                        '--data-urlencode', 'query=' + query,
                        '-H', 'Accept: application/sparql-results+json',
                        '-H', 'User-Agent: ' + UA], capture_output=True, check=True)
    rows = json.loads(r.stdout)['results']['bindings']
    refs: dict[str, list[str]] = {}
    rejected = []
    for b in rows:
        ref = b['mer']['value'].strip()
        qid = b['item']['value'].rsplit('/', 1)[-1]
        if not REF.match(ref):
            rejected.append(ref)
            continue
        refs.setdefault(ref, []).append(qid)
    doc = {
        'schema': 1,
        'role': 'découverte de références seulement ; données descriptives jamais reprises de Wikidata',
        'query': query,
        'endpoint': 'https://query.wikidata.org/sparql',
        'licence': 'CC0 (Wikidata)',
        'fetchedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'rows': len(rows),
        'rejectedMalformed': sorted(rejected),
        'refs': {k: sorted(v) for k, v in sorted(refs.items())},
    }
    DISCOVERY.parent.mkdir(parents=True, exist_ok=True)
    DISCOVERY.write_text(json.dumps(doc, ensure_ascii=False, indent=0) + '\n', encoding='utf-8')
    return doc


def in_paris(n: dict) -> bool:
    insee = n.get('INSEE') or []
    com = ' '.join(n.get('COM') or []) + ' ' + ' '.join(n.get('WCOM') or [])
    return (any(str(i).startswith('751') for i in insee) or 'Paris' in com
            or '75' in (n.get('DPT') or []))


def arrondissement(n: dict) -> int | None:
    for text in (n.get('COM') or []) + (n.get('WCOM') or []):
        m = re.search(r'Paris\s+(\d{1,2})e', text)
        if m:
            return int(m.group(1))
    for code in n.get('INSEE') or []:
        m = re.match(r'^751(\d\d)$', str(code))
        if m and 1 <= int(m.group(1)) <= 20:
            return int(m.group(1))
    return None


def fetch(ref: str, delay: float) -> tuple[str, dict | None]:
    CACHE.mkdir(parents=True, exist_ok=True)
    path = CACHE / (ref + '.json')
    if path.exists():
        doc = json.loads(path.read_text(encoding='utf-8'))
        return doc['status'], doc.get('notice')
    for attempt in range(4):
        code, body = get(API + ref)
        if code == 200:
            notice = json.loads(body)
            path.write_text(json.dumps({'status': 'ok', 'notice': notice}, ensure_ascii=False),
                            encoding='utf-8')
            time.sleep(delay)
            return 'ok', notice
        if code == 404:
            path.write_text(json.dumps({'status': 'absent'}), encoding='utf-8')
            return 'absent', None
        time.sleep(2 + 3 * attempt)
    return 'erreur-reseau', None


def compact(n: dict) -> dict:
    out = {'ref': n['REF']}
    for k, name in FIELDS.items():
        v = n.get(k)
        if v in (None, '', [], {}):
            continue
        out[name] = v
    coor = n.get('POP_COORDONNEES') or {}
    if isinstance(coor.get('lat'), (int, float)) and isinstance(coor.get('lon'), (int, float)):
        out['wgs84'] = [round(coor['lon'], 7), round(coor['lat'], 7)]
    out['arrondissement'] = arrondissement(n)
    out['source'] = 'https://pop.culture.gouv.fr/notice/merimee/' + n['REF']
    return out


def main(argv=None) -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument('--discover', action='store_true')
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--delay', type=float, default=0.25)
    ap.add_argument('--workers', type=int, default=1,
                    help='requêtes simultanées (6 au plus, API publique)')
    a = ap.parse_args(argv)
    disc = discover() if a.discover or not DISCOVERY.exists() else \
        json.loads(DISCOVERY.read_text(encoding='utf-8'))
    index = json.loads(INDEX.read_text(encoding='utf-8'))
    from_index = [row[0] for row in index['entries']]
    refs = sorted(set(from_index) | set(disc['refs']))
    if a.limit:
        refs = refs[:a.limit]
    notices, status = [], {}
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=max(1, min(6, a.workers))) as pool:
        results = pool.map(lambda r: (r, *fetch(r, a.delay)), refs)
        for i, (ref, st, n) in enumerate(results):
            if st == 'ok' and n and not in_paris(n):
                st = 'hors-paris'
            status[ref] = st
            if st == 'ok':
                notices.append(compact(n))
            if (i + 1) % 100 == 0:
                print(i + 1, '/', len(refs), file=sys.stderr, flush=True)
    counts: dict[str, int] = {}
    for st in status.values():
        counts[st] = counts.get(st, 0) + 1
    doc = {
        'schema': 1,
        'source': 'API POP v2 du ministère de la Culture (base Mérimée), licence Etalab 2.0',
        'api': API + '<REF>',
        'generatedBy': 'scripts/fetch_pop_notices.py',
        'generatedAt': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'inputs': {'gameIndex': len(from_index), 'wikidataDiscovery': len(disc['refs']),
                   'union': len(refs)},
        'status': counts,
        'unresolved': sorted(r for r, s in status.items() if s != 'ok'),
        'notices': sorted(notices, key=lambda n: n['ref']),
    }
    OUT.write_text(json.dumps(doc, ensure_ascii=False, separators=(',', ':')) + '\n',
                   encoding='utf-8')
    print('notices', len(notices), counts)
    return 0 if counts.get('erreur-reseau', 0) == 0 else 3


if __name__ == '__main__':
    sys.exit(main())
