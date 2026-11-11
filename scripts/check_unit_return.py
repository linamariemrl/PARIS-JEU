#!/usr/bin/env python3
"""Contrôle d'une unité enrichie renvoyée par l'outil graphique externe.

Une unité enrichie n'entre dans le jeu que si elle :
1. désigne une unité existante ET la même version de base (sinon la base
   a changé entre-temps : l'enrichissement est périmé) ;
2. fournit un glTF 2.0 binaire valide (enrichi.glb) dans le repère local
   de l'unité (X est, Y haut, Z sud, origine = ancre EPSG:2154 + NGF) ;
3. reste dans l'emprise de l'unité (tolérance horizontale) et dans une
   hauteur plausible ;
4. déclare chaque source utilisée avec une licence ouverte autorisée,
   sans aucune source interdite (Google Earth/Maps/Street View, Apple, Bing) ;
5. respecte le budget de poids par unité (affichage mobile) ;
6. fournit chaque niveau de détail déclaré et un rapport de qualité complet,
   sans élément inventé (docs/CONSIGNE_OUTIL_ENRICHISSEMENT.md).

Usage : python scripts/check_unit_return.py <dossier-retour> [--base export/unites]
Code de sortie 0 si accepté, 1 sinon ; rapport JSON sur la sortie standard.
"""
from __future__ import annotations

import argparse
import json
import struct
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LICENCES = ('Licence Ouverte', 'Etalab', 'ODbL', 'CC0', 'CC-BY', 'CC BY', 'Copernicus', 'Domaine public')
INTERDITS = ('google', 'gstatic', 'googleapis', 'apple.com', 'bing', 'virtualearth', 'here.com', 'mapbox.com/satellite')
TOL_H = 3.0          # m, tolérance horizontale autour de l'emprise
BUDGET = {'batiment': 8_000_000, 'sol': 16_000_000}


def read_glb(path: Path) -> tuple[dict, bytes]:
    raw = path.read_bytes()
    magic, version, length = struct.unpack_from('<4sII', raw, 0)
    if magic != b'glTF' or version != 2 or length != len(raw):
        raise ValueError('en-tête glTF 2.0 binaire invalide')
    jlen, jtype = struct.unpack_from('<I4s', raw, 12)
    if jtype != b'JSON':
        raise ValueError('premier bloc JSON absent')
    gltf = json.loads(raw[20:20 + jlen])
    rest = raw[20 + jlen:]
    binary = b''
    if rest:
        blen, btype = struct.unpack_from('<I4s', rest, 0)
        if btype != b'BIN\0':
            raise ValueError('bloc binaire invalide')
        binary = rest[8:8 + blen]
    return gltf, binary


def position_bounds(gltf: dict) -> tuple[list[float], list[float]]:
    """Boîte englobante des sommets, transformations de nœuds comprises (translation/échelle)."""
    lo, hi = [float('inf')] * 3, [float('-inf')] * 3
    meshes = gltf.get('meshes', [])
    for node in gltf.get('nodes', []):
        if 'mesh' not in node:
            continue
        if 'matrix' in node or 'rotation' in node:
            raise ValueError('rotation ou matrice de nœud : appliquer les transformations aux sommets')
        t = node.get('translation', [0, 0, 0])
        s = node.get('scale', [1, 1, 1])
        for prim in meshes[node['mesh']]['primitives']:
            acc = gltf['accessors'][prim['attributes']['POSITION']]
            if 'min' not in acc or 'max' not in acc:
                raise ValueError('accesseur POSITION sans min/max')
            for i in range(3):
                a, b = acc['min'][i] * s[i] + t[i], acc['max'][i] * s[i] + t[i]
                lo[i], hi[i] = min(lo[i], a, b), max(hi[i], a, b)
    if lo[0] == float('inf'):
        raise ValueError('aucun maillage')
    return lo, hi


def triangles(gltf: dict) -> int:
    n = 0
    for m in gltf.get('meshes', []):
        for p in m['primitives']:
            if 'indices' in p:
                n += gltf['accessors'][p['indices']]['count'] // 3
            else:
                n += gltf['accessors'][p['attributes']['POSITION']]['count'] // 3
    return n


def footprint_errors(base: dict, lo, hi, warnings: list) -> list[str]:
    errors = []
    g = base['georeferencement']
    anc = g['ancre']
    if base['type'] == 'batiment':
        e0, n0, e1, n1 = g['bbox2154']
        hmax = base['attributs']['hauteurM']
    else:
        cs = g['coins2154']
        e0, n0 = min(c[0] for c in cs), min(c[1] for c in cs)
        e1, n1 = max(c[0] for c in cs), max(c[1] for c in cs)
        hmax = None
    # Repère local : X = e - ancre.e ; Z = -(n - ancre.n).
    if lo[0] < e0 - anc['e'] - TOL_H or hi[0] > e1 - anc['e'] + TOL_H:
        errors.append('maquette hors emprise (est-ouest)')
    if lo[2] < -(n1 - anc['n']) - TOL_H or hi[2] > -(n0 - anc['n']) + TOL_H:
        errors.append('maquette hors emprise (nord-sud)')
    if lo[1] < -15:
        errors.append('maquette enterrée de plus de 15 m')
    if hmax is not None and hi[1] > max(hmax * 1.6, hmax + 25):
        warnings.append('hauteur %.1f m très supérieure à la hauteur IGN %.1f m : à justifier' % (hi[1], hmax))
    return errors


def check(ret: Path, base_root: Path) -> dict:
    errors, warnings = [], []
    try:
        doc = json.loads((ret / 'unite.json').read_text(encoding='utf-8'))
    except (OSError, ValueError) as e:
        return {'accepte': False, 'erreurs': ['unite.json illisible : %s' % e]}
    uid = doc.get('id', '')
    base_path = base_root / uid.replace(':', '/') / 'unite.json'
    if not base_path.exists():
        return {'id': uid, 'accepte': False, 'erreurs': ['unité de base inconnue : ' + uid]}
    base = json.loads(base_path.read_text(encoding='utf-8'))
    if doc.get('versionBase') != base['versionBase']:
        errors.append('version de base périmée (%s ≠ %s)' % (doc.get('versionBase'), base['versionBase']))
    if doc.get('georeferencement', {}).get('ancre') != base['georeferencement']['ancre']:
        errors.append('ancre de géoréférencement modifiée')
    enr = doc.get('enrichissement') or {}
    for k in ('outil', 'version', 'date', 'sources'):
        if not enr.get(k):
            errors.append('enrichissement.' + k + ' manquant')
    for src in enr.get('sources', []):
        text = json.dumps(src).lower()
        if any(f in text for f in INTERDITS):
            errors.append('source interdite : ' + src.get('id', src.get('url', '?')))
        if not any(l.lower() in str(src.get('licence', '')).lower() for l in LICENCES):
            errors.append('licence non autorisée ou absente : ' + str(src.get('id', '?')))
    stats = {}
    files = ['enrichi.glb'] + [l.get('fichier') for l in enr.get('niveauxDeDetail', []) if l.get('fichier')]
    total = 0
    for name in dict.fromkeys(files):
        if '/' in name or '\\' in name or not name.endswith('.glb'):
            errors.append('nom de fichier de niveau de détail invalide : ' + name)
            continue
        glb = ret / name
        if not glb.exists():
            errors.append(name + ' absent')
            continue
        total += glb.stat().st_size
        try:
            gltf, _ = read_glb(glb)
            lo, hi = position_bounds(gltf)
            stats[name] = {'octets': glb.stat().st_size, 'triangles': triangles(gltf), 'boite': [lo, hi]}
            errors += [name + ' : ' + e for e in footprint_errors(base, lo, hi, warnings)]
        except (ValueError, KeyError, IndexError, struct.error) as e:
            errors.append(name + ' : glTF invalide : %s' % e)
    if total > BUDGET.get(base['type'], 8_000_000) * 1.5:
        errors.append('poids total %d o > budget' % total)
    if 'enrichi.glb' in stats and stats['enrichi.glb']['octets'] > BUDGET.get(base['type'], 8_000_000):
        errors.append('enrichi.glb : poids > budget %d o' % BUDGET[base['type']])
    try:
        rq = json.loads((ret / 'rapport-qualite.json').read_text(encoding='utf-8'))
        if rq.get('unite') != uid or rq.get('versionBase') != base['versionBase']:
            errors.append('rapport de qualité : unité ou version différente')
        for k in ('mesures', 'declarations', 'attributions', 'outil'):
            if not rq.get(k):
                errors.append('rapport de qualité : ' + k + ' manquant')
        if (rq.get('declarations') or {}).get('elementsInventes'):
            errors.append('éléments inventés déclarés : refus (déclarer une hypothèse, ne pas inventer)')
    except (OSError, ValueError):
        errors.append('rapport-qualite.json absent ou illisible')
    return {'id': uid, 'accepte': not errors, 'erreurs': errors, 'avertissements': warnings, 'mesures': stats}


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('retour', type=Path)
    ap.add_argument('--base', type=Path, default=ROOT / 'export/unites')
    a = ap.parse_args(argv)
    report = check(a.retour, a.base)
    print(json.dumps(report, ensure_ascii=False, indent=1))
    return 0 if report['accepte'] else 1


if __name__ == '__main__':
    sys.exit(main())
