#!/usr/bin/env python3
"""R09 lot 3 : contrôles qualité de l'inventaire POP vérifié et des fiches.

Entrées : data/heritage/pop-notices-paris.json, fiches publiées, monuments.json,
landmark-catalog.json, monuments-paris-index.json.
Sortie : data/heritage/controles-pop-paris.json (+ résumé imprimé).

Contrôles (signalements, jamais de correction silencieuse) :
1. localisation — arrondissement de la commune POP ≠ arrondissement du point POP ;
   point du jeu (monuments.json) éloigné du point POP officiel ;
   arrondissement de l'index du jeu ≠ arrondissement POP ;
2. noms multiples — appellations officielles (APPL) distinctes du titre ;
3. sites disparus ou fragmentaires — champ ETAT (détruit, vestiges, fragment) ;
4. protections — nature d'acte (arrêté, liste, décret) affichée comme protection
   dans l'atlas ; notice MH (PA) sans champ PROT ;
5. doublons potentiels — même titre normalisé et même arrondissement, ou points
   POP à moins de 3 m (souvent des parties d'un même ensemble) ;
6. fiches sans référence — lieux prioritaires du catalogue sans notice POP ;
7. liens — URL des champs LIENS ; vérifiées en ligne avec --liens (sinon
   le dernier résultat enregistré est repris).
"""
from __future__ import annotations

import argparse
import json
import math
import re
import subprocess
import unicodedata
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLACES = ROOT / 'public/data/metropole/places'
SOURCE = ROOT / 'data/heritage/pop-notices-paris.json'
OUT = ROOT / 'data/heritage/controles-pop-paris.json'
LON, LAT = 2.3537, 48.8545
MX = 111320 * math.cos(math.radians(LAT))
MZ = 111132
FAR_M = 150  # point du jeu à plus de 150 m du point POP officiel
NEAR_M = 3
ACT_ONLY = re.compile(r'^(arrêté|liste|décret|certificat|journal officiel)(;(arrêté|liste|décret|certificat|journal officiel))*$')
GONE = {'détruit', 'vestiges', 'fragment'}


def load_builder():
    import importlib.util
    spec = importlib.util.spec_from_file_location('fiches', ROOT / 'scripts/build_history_fiches.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def fold(s: str) -> str:
    s = unicodedata.normalize('NFD', s.lower())
    s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()


def xz(lon, lat):
    return (lon - LON) * MX, (lat - LAT) * MZ


def check_links(urls: list[str]) -> dict:
    out = {}
    for u in urls:
        r = subprocess.run(['curl', '-s', '-o', '/dev/null', '-L', '-w', '%{http_code}',
                            '--max-time', '25', '-I', u], capture_output=True, text=True)
        code = int(r.stdout or 0)
        if code in (403, 405, 0):  # certains serveurs refusent HEAD
            r = subprocess.run(['curl', '-s', '-o', '/dev/null', '-L', '-w', '%{http_code}',
                                '--max-time', '25', '-r', '0-0', u], capture_output=True, text=True)
            code = int(r.stdout or 0)
        out[u] = code
    return out


def audit(link_status: dict | None = None) -> dict:
    mod = load_builder()
    arrs = mod.arrondissements()
    notices = json.loads(SOURCE.read_text(encoding='utf-8'))['notices']
    game = {r['ref']: r for r in json.loads((PLACES / 'monuments.json').read_text(encoding='utf-8'))['records']}
    game_idx = {row[0]: row[1] for row in
                json.loads((PLACES / 'monuments-paris-index.json').read_text(encoding='utf-8'))['entries']}
    catalog = json.loads((PLACES / 'landmark-catalog.json').read_text(encoding='utf-8'))

    loc_commune, loc_game, loc_index, names, gone, prot_missing = [], [], [], [], [], []
    no_point = []
    by_title = defaultdict(list)
    points = []
    links = []
    for n in notices:
        ref = n['ref']
        point_arr = mod.locate(arrs, *n['wgs84']) if n.get('wgs84') else None
        if n.get('arrondissement') and point_arr and point_arr != n['arrondissement']:
            loc_commune.append({'ref': ref, 'titre': n.get('titre'), 'commune': n['arrondissement'],
                                'point': point_arr})
        if ref in game and n.get('wgs84'):
            x, z = xz(*n['wgs84'])
            d = math.hypot(x - game[ref]['x'], z - game[ref]['z'])
            if d > FAR_M:
                loc_game.append({'ref': ref, 'titre': n.get('titre'), 'ecartMetres': round(d)})
        arr = n.get('arrondissement') or point_arr
        if ref in game_idx and arr and game_idx[ref] != arr:
            loc_index.append({'ref': ref, 'titre': n.get('titre'), 'indexJeu': game_idx[ref], 'pop': arr})
        title = fold(n.get('titre') or '')
        alts = [a for a in mod.as_list(n.get('appellations')) if fold(a) and fold(a) not in title]
        if alts:
            names.append({'ref': ref, 'titre': n.get('titre'), 'appellations': alts})
        etat = set(n.get('etat') or [])
        if etat & GONE:
            gone.append({'ref': ref, 'titre': n.get('titre'), 'etat': sorted(etat)})
        if ref.startswith('PA') and not n.get('protection'):
            prot_missing.append({'ref': ref, 'titre': n.get('titre')})
        if title and arr:
            by_title[(title, arr)].append(ref)
        if 'pointRejete' in n:
            no_point.append({'ref': ref, 'titre': n.get('titre'), 'pointPOP': n['pointRejete']})
        if n.get('wgs84'):
            points.append((ref, *xz(*n['wgs84'])))
        links += [(ref, u.strip()) for u in n.get('liens') or [] if u.strip()]

    dup_title = [{'titre': k[0], 'arrondissement': k[1], 'refs': sorted(v)}
                 for k, v in sorted(by_title.items()) if len(v) > 1]
    grid = defaultdict(list)
    for p in points:
        grid[(int(p[1] // 10), int(p[2] // 10))].append(p)
    close = set()
    for (gx, gz), cell in grid.items():
        for dx in (-1, 0, 1):
            for dz in (-1, 0, 1):
                for a in cell:
                    for b in grid.get((gx + dx, gz + dz), []):
                        if a[0] < b[0] and math.hypot(a[1] - b[1], a[2] - b[2]) < NEAR_M:
                            close.add((a[0], b[0]))
    act = [{'ref': r['ref'], 'titre': r['name'], 'valeur': r['protection']}
           for r in game.values() if ACT_ONLY.match(r.get('protection') or '')]
    no_ref = [{'nom': e['name'], 'source': e.get('sourceUrl')} for e in catalog['pending']]

    link_rows = []
    for ref, u in links:
        code = (link_status or {}).get(u)
        link_rows.append({'ref': ref, 'url': u, 'http': code})
    broken = [r for r in link_rows if r['http'] is not None and not 200 <= r['http'] < 400]

    return {
        'schema': 1,
        'generatedBy': 'scripts/audit_pop_inventory.py',
        'regle': 'Signalements à examiner : aucune donnée corrigée automatiquement.',
        'resume': {
            'notices': len(notices),
            'localisationCommuneContrePoint': len(loc_commune),
            'pointJeuEloigneDuPointPOP': len(loc_game),
            'arrondissementIndexJeuDifferent': len(loc_index),
            'nomsMultiples': len(names),
            'sitesDetruitsOuFragmentaires': len(gone),
            'pointPOPinvalideEcarte': len(no_point),
            'noticesMHsansProtection': len(prot_missing),
            'acteAfficheCommeProtection': len(act),
            'doublonsTitreArrondissement': len(dup_title),
            'pointsQuasiConfondus': len(close),
            'lieuxPrioritairesSansReference': len(no_ref),
            'liens': len(link_rows),
            'liensVerifies': sum(1 for r in link_rows if r['http'] is not None),
            'liensEnErreur': len(broken),
        },
        'localisationCommuneContrePoint': loc_commune,
        'pointJeuEloigneDuPointPOP': sorted(loc_game, key=lambda r: -r['ecartMetres']),
        'arrondissementIndexJeuDifferent': loc_index,
        'nomsMultiples': names,
        'sitesDetruitsOuFragmentaires': gone,
        'pointPOPinvalideEcarte': no_point,
        'noticesMHsansProtection': prot_missing,
        # Défaut d'affichage corrigé dans l'atlas ; on garde le décompte et 20 exemples.
        'acteAfficheCommeProtection': sorted(act, key=lambda r: r['ref'])[:20],
        'doublonsTitreArrondissement': dup_title,
        'pointsQuasiConfondus': [list(p) for p in sorted(close)],
        'lieuxPrioritairesSansReference': no_ref,
        'liens': link_rows,
        'liensEnErreur': broken,
    }


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--liens', action='store_true', help='vérifier les liens en ligne')
    a = ap.parse_args(argv)
    previous = json.loads(OUT.read_text(encoding='utf-8')) if OUT.exists() else {}
    status = {r['url']: r['http'] for r in previous.get('liens', [])}
    checked_at = previous.get('liensVerifiesLe')
    if a.liens:
        urls = sorted({u for n in json.loads(SOURCE.read_text(encoding='utf-8'))['notices']
                       for u in n.get('liens') or [] if u.strip()})
        urls = [u.strip() for u in urls]
        status = check_links(urls)
        checked_at = datetime.now(timezone.utc).isoformat(timespec='seconds')
    doc = audit(status)
    doc['liensVerifiesLe'] = checked_at
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(json.dumps(doc['resume'], ensure_ascii=False, indent=1))


if __name__ == '__main__':
    main()
