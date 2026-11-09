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
- ``pop-point-in-enclosed-courtyard`` : le point tombe dans une cour
  FERMÉE (trou du polygone) ; le seul bâtiment qui entoure cette cour est
  retenu. Une cour d'honneur ouverte n'est jamais rattachée ainsi ;
- ``no-footprint-found`` : aucun contour ne contient le point, ou la notice
  n'a pas de point ; aucune extrusion ne sera jamais masquée pour elle.
  ``nearestFootprintMeters`` aide la complétion manuelle, sans rien
  rattacher automatiquement.

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


def in_courtyard(polygons, x, z):
    """Vrai si le point est dans un trou (cour fermée) du polygone."""
    return any(poly and ring_contains(poly[0], x, z) and any(
        ring_contains(r, x, z) for r in poly[1:]) for poly in polygons)


def segment_distance(x, z, a, b):
    dx, dz = b[0] - a[0], b[1] - a[1]
    t = 0.0 if dx == dz == 0 else max(0.0, min(1.0, (
        (x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)))
    return math.hypot(x - a[0] - t * dx, z - a[1] - t * dz)


def ring_distance(polygons, x, z):
    return min(segment_distance(x, z, r[i - 1], r[i])
               for poly in polygons for r in poly[:1] for i in range(len(r)))


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
    courtyard = {ref: set() for ref in refs}
    nearest = {ref: math.inf for ref in refs}
    for ign_id, polys, (x0, z0, x1, z1) in tiles():
        for ref in refs:
            pt = points.get(ref)
            if not pt or not (x0 - 60 <= pt[0] <= x1 + 60 and
                              z0 - 60 <= pt[1] <= z1 + 60):
                continue
            nearest[ref] = min(nearest[ref], ring_distance(polys, *pt))
            if not (x0 <= pt[0] <= x1 and z0 <= pt[1] <= z1):
                continue
            if contains(polys, pt[0], pt[1]):
                found[ref].add(ign_id)
            elif in_courtyard(polys, pt[0], pt[1]):
                courtyard[ref].add(ign_id)
    entries = []
    for ref in refs:
        ids = sorted(found[ref])
        if ids:
            status = ('single-footprint-pop-point' if len(ids) == 1 else
                      'multiple-footprints-pop-point')
        elif len(courtyard[ref]) == 1:
            ids = sorted(courtyard[ref])
            status = 'pop-point-in-enclosed-courtyard'
        else:
            status = 'no-footprint-found'
        entry = {'ref': ref, 'ignIds': ids, 'parts': [], 'status': status}
        if not ids:
            entry['nearestFootprintMeters'] = (
                None if ref not in points or math.isinf(nearest[ref])
                else round(nearest[ref], 1))
        entries.append(entry)
    doc = {
        'schema': 1,
        'rule': ('Point POP/Mérimée à l\'intérieur du contour extérieur '
                 'IGN BD TOPO, ou dans une cour fermée de ce contour. '
                 'Provenance, non certification juridique ou architecturale '
                 'de chaque aile. Les autres rattachements (ensembles, '
                 'cours d\'honneur ouvertes, ailes) se complètent à la main.'),
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
