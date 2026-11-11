"""Validation géométrique EXACTE et hors ligne d'une maquette (R03-B2).

La grille d'échantillonnage du moteur (`polygonCoverage`) reste un garde-fou
d'exécution. Avant toute certification, ce script calcule avec GEOS
(Shapely) des aires exactes :

- projection horizontale = union exacte des triangles non verticaux ;
- manque = emprise IGN - (projection élargie de la tolérance) ;
- débordement = projection - (emprise élargie de la tolérance) ;
- différence symétrique, en m² et en % de l'aire de l'emprise ;
- géométrie invalide (emprise ou projection) : rejet, jamais de réparation
  silencieuse.

La tolérance est OBLIGATOIRE et doit être accompagnée de sa justification
(précision publiée de la source) : aucun seuil n'est inventé ici.

Usage :
  python scripts/validate_model_geometry.py --model M.json --ign-id BATIMENT... \
      --tolerance 1.0 --tolerance-source "précision déclarée de ..."
"""
from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

from shapely import constrained_delaunay_triangles  # noqa: F401 (réexport tests)
from shapely.geometry import MultiPolygon, Polygon
from shapely.ops import unary_union
from shapely.validation import explain_validity

ROOT = Path(__file__).resolve().parents[1]
CENTER = (2.3537, 48.8545)
MAX_MISSING = 0.05
MAX_SPILL = 0.05


def project(lon, lat, center=CENTER):
    mx = 111320 * math.cos(center[1] * math.pi / 180)
    return ((lon - center[0]) * mx, (lat - center[1]) * 111132)


def unproject(x, z, center=CENTER):
    mx = 111320 * math.cos(center[1] * math.pi / 180)
    return (x / mx + center[0], z / 111132 + center[1])


def footprint_from_building(building, center=CENTER):
    polys = []
    for poly in building['polygons']:
        rings = [[(p[0], p[1]) if building.get('localCoordinates')
                  else project(p[0], p[1], center) for p in ring]
                 for ring in poly]
        polys.append(Polygon(rings[0], rings[1:]))
    return polys[0] if len(polys) == 1 else MultiPolygon(polys)


def scene_positions(model, frame=None):
    """Positions de scène [x, y, z, ...] de chaque partie.

    'epsg2154-relative' est converti par PROJ (pyproj), indépendamment du
    code TypeScript du moteur : les deux chemins se contrôlent mutuellement.
    """
    if model.get('coordinates', 'paris-local-xyz') == 'paris-local-xyz':
        return [p['positions'] for p in model['parts']]
    if model['coordinates'] != 'epsg2154-relative':
        raise ValueError('repère inconnu : ' + str(model['coordinates']))
    from pyproj import Transformer
    frame = frame or {'center': CENTER, 'displayReferenceAltitudeM': 35.0}
    to_ll = Transformer.from_crs('EPSG:2154', 'EPSG:4326', always_xy=True)
    o = model['originL93']
    out = []
    for part in model['parts']:
        P, res = part['positions'], []
        for i in range(0, len(P), 3):
            lon, lat = to_ll.transform(o[0] + P[i], o[1] + P[i + 1])
            x, z = project(lon, lat, frame['center'])
            res += [x, o[2] + P[i + 2] - frame['displayReferenceAltitudeM'], z]
        out.append(res)
    return out


def projection(model, frame=None):
    tris = []
    for part, P in zip(model['parts'], scene_positions(model, frame)):
        I = part['indices']
        for k in range(0, len(I) - 2, 3):
            a, b, c = ((P[3 * I[j]], P[3 * I[j] + 2]) for j in (k, k + 1, k + 2))
            t = Polygon([a, b, c])
            if t.area > 1e-6:
                tris.append(t)
    return unary_union(tris) if tris else Polygon()


def validate(model_geom, footprint, tolerance, tolerance_source):
    if not tolerance_source or tolerance is None or tolerance < 0:
        raise ValueError('tolérance et justification de source obligatoires')
    report = {'toleranceM': tolerance, 'toleranceSource': tolerance_source,
              'errors': []}
    for name, g in (('emprise', footprint), ('maquette', model_geom)):
        if not g.is_valid:
            report['errors'].append(name + ' invalide : ' + explain_validity(g))
    area = footprint.area if footprint.is_valid else 0.0
    if model_geom.is_empty:
        report['errors'].append('projection horizontale vide (murs seuls ?)')
    if report['errors'] or area <= 0:
        report['ok'] = False
        return report
    missing = footprint.difference(model_geom.buffer(tolerance))
    spill = model_geom.difference(footprint.buffer(tolerance))
    sym = model_geom.symmetric_difference(footprint)
    parts = lambda g: [] if g.is_empty else (list(g.geoms) if hasattr(g, 'geoms') else [g])
    report.update({
        'footprintAreaM2': round(area, 3),
        'modelAreaM2': round(model_geom.area, 3),
        'missingAreaM2': round(missing.area, 3),
        'missingPct': round(100 * missing.area / area, 3),
        'spillAreaM2': round(spill.area, 3),
        'spillPct': round(100 * spill.area / area, 3),
        'symmetricDifferenceM2': round(sym.area, 3),
        'largestMissingM2': round(max((g.area for g in parts(missing)), default=0), 3),
        'largestSpillM2': round(max((g.area for g in parts(spill)), default=0), 3),
    })
    report['ok'] = (missing.area / area <= MAX_MISSING and
                    spill.area / area <= MAX_SPILL)
    return report


def certification_fields(raw, model_path, ign_id):
    """Champs qui lient un rapport à UN fichier de maquette et UNE emprise."""
    import hashlib
    return {'schema': 1, 'tool': 'scripts/validate_model_geometry.py',
            'model': str(model_path), 'modelSha256': hashlib.sha256(raw).hexdigest(),
            'ignId': ign_id}


def check_certification_report(report, model_bytes, ign_ids):
    """Erreurs empêchant d'utiliser ce rapport pour certifier une maquette."""
    import hashlib
    errors = []
    if report.get('tool') != 'scripts/validate_model_geometry.py':
        errors.append('rapport non produit par le validateur exact')
    if report.get('ok') is not True:
        errors.append('validation exacte non réussie')
    if report.get('errors'):
        errors.append('rapport avec erreurs géométriques')
    if not report.get('toleranceSource'):
        errors.append('tolérance sans justification de source')
    if report.get('ignId') not in ign_ids:
        errors.append('emprise IGN du rapport hors de la table patrimoniale')
    if report.get('modelSha256') != hashlib.sha256(model_bytes).hexdigest():
        errors.append('rapport ne correspondant pas au fichier publié')
    return errors


def load_building(ign_id):
    for path in sorted((ROOT / 'public/data/4e/tiles').glob('*.json')) + \
            sorted((ROOT / 'public/data/metropole/buildings/tiles').glob('*.json')):
        doc = json.loads(path.read_text(encoding='utf-8'))
        for b in doc['buildings']:
            if b['id'] == ign_id:
                if doc.get('localCoordinates'):
                    b['localCoordinates'] = True
                return b
    raise KeyError(ign_id)


def main(argv=None):
    ap = argparse.ArgumentParser()
    ap.add_argument('--model', required=True)
    ap.add_argument('--ign-id', required=True)
    ap.add_argument('--tolerance', type=float, required=True)
    ap.add_argument('--tolerance-source', required=True)
    ap.add_argument('--out', help='rapport JSON exigé par la certification')
    a = ap.parse_args(argv)
    raw = Path(a.model).read_bytes()
    model = json.loads(raw.decode('utf-8'))
    fp = footprint_from_building(load_building(a.ign_id))
    rep = validate(projection(model), fp, a.tolerance, a.tolerance_source)
    rep.update(certification_fields(raw, a.model, a.ign_id))
    print(json.dumps(rep, ensure_ascii=False, indent=1))
    if a.out:
        Path(a.out).write_text(json.dumps(rep, ensure_ascii=False, indent=1) + '\n',
                               encoding='utf-8')
    return 0 if rep['ok'] else 1


if __name__ == '__main__':
    sys.exit(main())
