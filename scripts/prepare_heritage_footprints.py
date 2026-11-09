"""Construit la table de correspondance patrimoine -> emprises IGN (R02-D3).

Règle unique et hors ligne : une emprise IGN est rattachée à une référence
des dossiers architecturaux dotés d'une référence POP (140 sur 195) lorsque le point de la notice POP/Mérimée
tombe à l'intérieur de son contour extérieur (et hors de ses cours).
C'est la même règle que `HeritageAtlas.tag`, mais figée dans un fichier :
le moteur ne fait plus aucune inférence géographique à la volée pour le
masquage ou la sélection des extrusions remplacées.

Le statut documente la provenance, il ne certifie rien :
- ``single-footprint-pop-point`` : un seul contour contient le point POP ;
- ``multiple-footprints-pop-point`` : plusieurs contours (couches 4e et
  métropole superposées, ou emprises IGN empilées) contiennent le point ;
- ``no-footprint-found`` : aucun contour ne contient le point, ou la notice
  n'a pas de point ; aucune extrusion ne sera jamais masquée pour elle.

Les ensembles et parties (plusieurs références pour une emprise, ou
plusieurs emprises pour une référence) se complètent à la main dans
``ignIds`` ; ``parts`` reste vide tant qu'aucune découpe n'est certifiée.
"""
from __future__ import annotations

import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'public' / 'data'
OUT = DATA / 'metropole' / 'architecture' / 'heritage-footprints.json'
CENTER = (2.3537, 48.8545)
METERS_X = 111320 * math.cos(CENTER[1] * math.pi / 180)
METERS_Z = 111132


def project(p):
    return ((p[0] - CENTER[0]) * METERS_X, (p[1] - CENTER[1]) * METERS_Z)


def ring_contains(ring, x, z):
    inside = False
    j = len(ring) - 1
    for i in range(len(ring)):
        xi, zi = ring[i][0], ring[i][1]
        xj, zj = ring[j][0], ring[j][1]
        if (zi > z) != (zj > z) and x < (xj - xi) * (z - zi) / (zj - zi) + xi:
            inside = not inside
        j = i
    return inside


def contains(polygons, x, z):
    for poly in polygons:
        if poly and ring_contains(poly[0], x, z) and not any(
                ring_contains(r, x, z) for r in poly[1:]):
            return True
    return False


def tiles():
    for folder, local in ((DATA / '4e' / 'tiles', False),
                          (DATA / 'metropole' / 'buildings' / 'tiles', True)):
        for path in sorted(folder.glob('*.json')):
            doc = json.loads(path.read_text(encoding='utf-8'))
            local_tile = local or bool(doc.get('localCoordinates'))
            for b in doc['buildings']:
                polys = b['polygons'] if local_tile else [
                    [[project(p) for p in ring] for ring in poly]
                    for poly in b['polygons']]
                xs = [p[0] for poly in polys for p in poly[0]]
                zs = [p[1] for poly in polys for p in poly[0]]
                if xs:
                    yield b['id'], polys, (min(xs), min(zs), max(xs), max(zs))


def main():
    dossiers = json.loads((DATA / 'metropole' / 'architecture' /
                           'dossiers.json').read_text(encoding='utf-8'))
    notices = json.loads((DATA / 'metropole' / 'places' /
                          'monuments.json').read_text(encoding='utf-8'))
    points = {n['ref']: (n['x'], n['z']) for n in notices['records']
              if isinstance(n.get('x'), (int, float))
              and isinstance(n.get('z'), (int, float))}
    # Les dossiers « candidate:… » sans référence POP n'ont ni point ni
    # maquette publiable : ils n'entrent pas dans la table.
    refs = [d['ref'] for d in dossiers['dossiers'] if d.get('ref')]
    found = {ref: set() for ref in refs}
    for ign_id, polys, (x0, z0, x1, z1) in tiles():
        for ref in refs:
            pt = points.get(ref)
            if not pt or not (x0 <= pt[0] <= x1 and z0 <= pt[1] <= z1):
                continue
            if contains(polys, pt[0], pt[1]):
                found[ref].add(ign_id)
    entries = []
    for ref in refs:
        ids = sorted(found[ref])
        status = ('no-footprint-found' if not ids else
                  'single-footprint-pop-point' if len(ids) == 1 else
                  'multiple-footprints-pop-point')
        entries.append({'ref': ref, 'ignIds': ids, 'parts': [],
                        'status': status})
    doc = {
        'schema': 1,
        'rule': ('Point POP/Mérimée à l\'intérieur du contour extérieur '
                 'IGN BD TOPO, hors cours. Provenance, non certification '
                 'juridique ou architecturale de chaque aile.'),
        'generatedBy': 'scripts/prepare_heritage_footprints.py',
        'entries': entries,
    }
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + '\n',
                   encoding='utf-8')
    counts = {}
    for e in entries:
        counts[e['status']] = counts.get(e['status'], 0) + 1
    print(len(entries), 'références', counts,
          sum(len(e['ignIds']) for e in entries), 'emprises')


if __name__ == '__main__':
    main()
