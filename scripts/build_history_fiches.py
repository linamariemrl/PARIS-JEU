#!/usr/bin/env python3
"""R09 : fiches Histoire des édifices de Paris, uniquement à partir de faits attestés.

Entrée : data/heritage/pop-notices-paris.json
(produit par scripts/fetch_pop_notices.py depuis l'API POP officielle).

Règles éditoriales, vérifiées par tests :
- aucune phrase n'introduit une information absente de la notice officielle ;
- le texte historique officiel (champ HIST) est repris intégralement, attribué ;
- toute rubrique sans source est déclarée « non renseignée », jamais comblée ;
- chaque fiche porte un statut de complétude et la liste de ses manques.

Sorties (chargées à la demande, par arrondissement) :
- public/data/metropole/places/fiches/index.json
- public/data/metropole/places/fiches/arr-01.json … arr-20.json, hors-arr.json
"""
from __future__ import annotations

import json
import math
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLACES = ROOT / 'public/data/metropole/places'
SOURCE = ROOT / 'data/heritage/pop-notices-paris.json'
OUTDIR = PLACES / 'fiches'
BOUNDARY = ROOT / 'public/data/metropole/limits.geojson'
CATALOG = PLACES / 'landmark-catalog.json'
GAME_INDEX = PLACES / 'monuments-paris-index.json'
LON, LAT = 2.3537, 48.8545
MX = 111320 * math.cos(math.radians(LAT))
MZ = 111132
HIST_MIN = 120  # en dessous, le champ est une mention, pas un récit

BASES = {
    'PA': 'Monument historique (immeuble protégé)',
    'IA': 'Inventaire général du patrimoine culturel',
    'AC': 'Label Architecture contemporaine remarquable',
    'EA': 'Patrimoine du XXe siècle (repérage)',
    'MD': 'Label Maisons des Illustres',
    'PJ': 'Parcs et jardins (pré-inventaire)',
    'JA': 'Label Jardin remarquable',
}


def clean(text: str) -> str:
    text = re.sub(r'[ \t]+', ' ', text.replace('\r', ''))
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()


def join_fr(items: list[str]) -> str:
    items = [i for i in items if i]
    if len(items) <= 1:
        return ''.join(items)
    return ', '.join(items[:-1]) + ' et ' + items[-1]


def as_list(v) -> list[str]:
    if v is None:
        return []
    if isinstance(v, list):
        return [clean(str(x)) for x in v if str(x).strip()]
    return [clean(p) for p in str(v).split(';') if p.strip()]


def arrondissements():
    geo = json.loads(BOUNDARY.read_text(encoding='utf-8'))
    return {int(f['properties']['id'][-2:]): f['geometry']['coordinates']
            for f in geo['features'] if f['properties'].get('kind') == 'arrondissement'}


def ring(x, y, pts):
    inside = False
    for i in range(len(pts)):
        a, b = pts[i], pts[i - 1]
        if (a[1] > y) != (b[1] > y) and x < (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1]) + a[0]:
            inside = not inside
    return inside


def locate(arrs, lon, lat):
    hits = [a for a, rings in arrs.items()
            if ring(lon, lat, rings[0]) and not any(ring(lon, lat, r) for r in rings[1:])]
    return hits[0] if len(hits) == 1 else None


def summary(n: dict, arr: int | None) -> list[str]:
    """Phrases de repères, chacune strictement issue d'un champ POP."""
    out = []
    deno = as_list(n.get('denominations'))
    if deno:
        out.append('La notice officielle le désigne comme : ' + join_fr(deno) + '.')
    adr = n.get('adresseNormalisee') or n.get('adresse')
    if adr and arr:
        out.append(f'Il se situe {clean(adr)}, dans le {arr}e arrondissement.'
                   if arr > 1 else f'Il se situe {clean(adr)}, dans le 1er arrondissement.')
    elif arr:
        out.append(f'Il se situe dans le {arr}e arrondissement.' if arr > 1
                   else 'Il se situe dans le 1er arrondissement.')
    sc = as_list(n.get('siecles'))
    if sc:
        out.append('Campagnes de construction relevées : ' + join_fr(sc) + '.')
    dates = as_list(n.get('dates'))
    if dates:
        just = as_list(n.get('justificationDates'))
        out.append('Dates attestées : ' + join_fr(dates) +
                   (' (' + join_fr(just) + ')' if just else '') + '.')
    aut = as_list(n.get('auteurs'))
    if aut:
        out.append('Auteurs cités par la notice : ' + join_fr(aut) + '.')
    prot = as_list(n.get('protection'))
    if prot:
        out.append('Protection : ' + join_fr(prot) +
                   (' (' + clean(n['datesProtection']) + ')' if n.get('datesProtection') else '') + '.')
    if n.get('label'):
        out.append('Label : ' + clean(n['label']) + '.')
    if n.get('statutProprietaire'):
        out.append('Statut du propriétaire : ' + clean(n['statutProprietaire']) + '.')
    if n.get('affectataire'):
        out.append('Affectataire : ' + clean(n['affectataire']) + '.')
    return out


def fiche(n: dict, arr: int | None, major: set[str]) -> dict:
    hist = clean(n.get('historique') or '')
    desc = clean(n.get('description') or '')
    rubriques = {
        'identification': bool(n.get('titre')),
        'localisation': arr is not None,
        'datation': bool(n.get('siecles') or n.get('dates')),
        'auteurs': bool(n.get('auteurs')),
        'historique': len(hist) >= HIST_MIN,
        'protection': bool(n.get('protection') or n.get('label')),
    }
    missing = [k for k, ok in rubriques.items() if not ok]
    if not missing:
        status = 'documentee'
    elif rubriques['historique']:
        status = 'recit-officiel-partiel'
    elif rubriques['datation']:
        status = 'reperes-dates'
    else:
        status = 'minimale'
    ref = n['ref']
    f = {
        'ref': ref,
        'titre': clean(n.get('titre') or ref),
        'base': BASES.get(ref[:2], 'Base Mérimée'),
        'majeur': ref in major,
        'arrondissement': arr,
        'reperes': summary(n, arr),
        'historique': hist or None,
        'description': desc or None,
        'precisionProtection': clean(n['precisionProtection']) if n.get('precisionProtection') else None,
        'observations': clean(n['observations']) if n.get('observations') else None,
        'statut': status,
        'manques': missing,
        'source': n['source'],
        'licence': 'Etalab 2.0 — notice POP/Mérimée, ministère de la Culture',
        'miseAJourSource': n.get('miseAJour'),
    }
    return {k: v for k, v in f.items() if v not in (None, [], '')}


def build():
    src = json.loads(SOURCE.read_text(encoding='utf-8'))
    arrs = arrondissements()
    major = {e['ref'] for e in json.loads(CATALOG.read_text(encoding='utf-8'))['linked'] if e.get('ref')}
    in_game = {row[0] for row in json.loads(GAME_INDEX.read_text(encoding='utf-8'))['entries']}
    shards: dict[str, list] = {}
    index = []
    for n in src['notices']:
        arr = n.get('arrondissement')
        located_by = 'commune-pop' if arr else None
        if arr is None and n.get('wgs84'):
            arr = locate(arrs, *n['wgs84'])
            located_by = 'point-pop-dans-arrondissement' if arr else None
        f = fiche(n, arr, major)
        key = f'arr-{arr:02d}' if arr else 'hors-arr'
        shards.setdefault(key, []).append(f)
        entry = {'ref': n['ref'], 'shard': key, 'titre': f['titre'], 'statut': f['statut'],
                 'arrondissement': arr, 'localisation': located_by,
                 'dansIndexDuJeu': n['ref'] in in_game}
        if n.get('wgs84'):
            lon, lat = n['wgs84']
            entry['x'] = round((lon - LON) * MX, 1)
            entry['z'] = round((lat - LAT) * MZ, 1)
        index.append(entry)
    stats = {'total': len(index), 'parStatut': {}, 'parArrondissement': {}, 'parBase': {},
             'majeurs': {'total': len(major), 'avecFiche': 0, 'parStatut': {}}}
    for e, f in ((e, next(x for x in shards[e['shard']] if x['ref'] == e['ref'])) for e in index):
        stats['parStatut'][f['statut']] = stats['parStatut'].get(f['statut'], 0) + 1
        k = str(e['arrondissement'] or 'non-localise')
        a = stats['parArrondissement'].setdefault(k, {'total': 0})
        a['total'] += 1
        a[f['statut']] = a.get(f['statut'], 0) + 1
        stats['parBase'][f['base']] = stats['parBase'].get(f['base'], 0) + 1
        if f.get('majeur'):
            stats['majeurs']['avecFiche'] += 1
            stats['majeurs']['parStatut'][f['statut']] = stats['majeurs']['parStatut'].get(f['statut'], 0) + 1
    stats['majeurs']['sansNoticeRecuperee'] = sorted(major - {e['ref'] for e in index})
    stats['horsIndexDuJeu'] = sum(1 for e in index if not e['dansIndexDuJeu'])
    return shards, index, stats, src


def main():
    shards, index, stats, src = build()
    OUTDIR.mkdir(parents=True, exist_ok=True)
    for old in OUTDIR.glob('*.json'):
        old.unlink()
    for key, items in shards.items():
        (OUTDIR / f'{key}.json').write_text(
            json.dumps({'schema': 1, 'shard': key, 'fiches': sorted(items, key=lambda f: f['ref'])},
                       ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    (OUTDIR / 'index.json').write_text(json.dumps({
        'schema': 1,
        'regle': 'Fiches composées uniquement de champs de la notice POP officielle ; '
                 'récit historique repris du champ HIST, jamais généré.',
        'sourceGeneratedAt': src['generatedAt'],
        'generatedBy': 'scripts/build_history_fiches.py',
        'statistiques': stats,
        'entrees': sorted(index, key=lambda e: e['ref']),
    }, ensure_ascii=False, separators=(',', ':')) + '\n', encoding='utf-8')
    print(json.dumps(stats['parStatut'], ensure_ascii=False), 'majeurs',
          json.dumps(stats['majeurs']['parStatut'], ensure_ascii=False))


if __name__ == '__main__':
    main()
