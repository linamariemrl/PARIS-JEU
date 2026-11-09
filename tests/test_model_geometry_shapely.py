"""R03-B2 : validation géométrique exacte (Shapely/GEOS), hors ligne.

Ces chiffres sont des cas d'essai synthétiques ou l'emprise IGN réelle de
l'Hôtel de Ville avec des maquettes FACTICES : ils qualifient l'outil, pas
une restitution architecturale ni une erreur topographique réelle.
"""
import json
import sys
import unittest
from pathlib import Path

from shapely import constrained_delaunay_triangles
from shapely.affinity import translate
from shapely.geometry import Polygon, box

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'scripts'))
import validate_model_geometry as V  # noqa: E402

TOL, SRC = 1.0, 'cas d\'essai : tolérance fixée par le test, sans source réelle'


def model_from(geom, y=10.0):
    """Maquette plate triangulée exactement (trous respectés)."""
    tris = constrained_delaunay_triangles(geom)
    pos, idx = [], []
    for t in tris.geoms:
        for x, z in list(t.exterior.coords)[:3]:
            idx.append(len(pos) // 3)
            pos += [x, y, z]
    return {'parts': [{'positions': pos, 'indices': idx}]}


def check(model_geom_or_model, footprint):
    m = model_geom_or_model
    geom = V.projection(m) if isinstance(m, dict) else m
    return V.validate(geom, footprint, TOL, SRC)


class ExactGeometry(unittest.TestCase):
    def test_courtyard_filled_vs_ring(self):
        court = Polygon([(0, 0), (40, 0), (40, 40), (0, 40)],
                        [[(10, 10), (30, 10), (30, 30), (10, 30)]])
        filled = check(model_from(box(0, 0, 40, 40)), court)
        self.assertFalse(filled['ok'])
        self.assertAlmostEqual(filled['spillAreaM2'], 18 * 18, delta=1)
        ring = check(model_from(court), court)
        self.assertTrue(ring['ok'])
        self.assertAlmostEqual(ring['missingAreaM2'], 0, places=3)

    def test_concave_exact_and_mirror(self):
        L = Polygon([(0, 0), (40, 0), (40, 10), (10, 10), (10, 40), (0, 40)])
        self.assertTrue(check(model_from(L), L)['ok'])
        mirror = Polygon([(0, 30), (40, 30), (40, 40), (0, 40)]).union(box(30, 0, 40, 30))
        r = check(model_from(mirror), L)
        self.assertFalse(r['ok'])
        self.assertGreater(r['missingPct'], 50)

    def test_missing_narrow_wing(self):
        # Aile de 1,5 m x 30 m (5,3 % de l'aire) absente de la maquette.
        body, wing = box(0, 0, 40, 20), box(19.25, 20, 20.75, 50)
        footprint = body.union(wing)
        r = check(model_from(body), footprint)
        self.assertFalse(r['ok'])
        self.assertGreater(r['missingAreaM2'], 40)
        self.assertGreater(r['largestMissingM2'], 40)

    def test_adjacent_buildings(self):
        a, b = box(0, 0, 20, 20), box(20, 0, 40, 20)
        self.assertTrue(check(model_from(a), a)['ok'])
        both = check(model_from(a.union(b)), a)
        self.assertFalse(both['ok'])
        self.assertAlmostEqual(both['spillAreaM2'], 20 * 19, delta=1)

    def test_vertical_triangles_only(self):
        walls = {'parts': [{'positions': [0, 0, 0, 40, 0, 0, 40, 18, 0, 0, 18, 0],
                            'indices': [0, 1, 2, 0, 2, 3]}]}
        r = check(walls, box(0, 0, 40, 20))
        self.assertFalse(r['ok'])
        self.assertIn('projection horizontale vide (murs seuls ?)', r['errors'])

    def test_roof_with_real_hole(self):
        holed = Polygon([(0, 0), (30, 0), (30, 30), (0, 30)],
                        [[(12, 12), (18, 12), (18, 18), (12, 18)]])
        g = V.projection(model_from(holed))
        self.assertAlmostEqual(g.area, holed.area, places=6)
        self.assertTrue(V.validate(g, holed, TOL, SRC)['ok'])

    def test_origin_change_is_invariant(self):
        L = Polygon([(0, 0), (40, 0), (40, 10), (10, 10), (10, 40), (0, 40)])
        m = Polygon([(0, 30), (40, 30), (40, 40), (0, 40)])
        r1 = V.validate(m, L, TOL, SRC)
        r2 = V.validate(translate(m, 5000, -3000), translate(L, 5000, -3000), TOL, SRC)
        for k in ('missingAreaM2', 'spillAreaM2', 'symmetricDifferenceM2', 'ok'):
            self.assertAlmostEqual(r1[k], r2[k], places=2)

    def test_invalid_geometry_rejected(self):
        bowtie = Polygon([(0, 0), (10, 10), (10, 0), (0, 10)])
        r = V.validate(box(0, 0, 10, 10), bowtie, TOL, SRC)
        self.assertFalse(r['ok'])
        self.assertTrue(any('emprise invalide' in e for e in r['errors']))

    def test_tolerance_requires_a_source(self):
        with self.assertRaises(ValueError):
            V.validate(box(0, 0, 1, 1), box(0, 0, 1, 1), 1.0, '')

    def test_real_hotel_de_ville_footprint(self):
        fp = V.footprint_from_building(V.load_building('BATIMENT0000000245157267'))
        self.assertTrue(fp.is_valid)
        exact = check(model_from(fp), fp)
        self.assertTrue(exact['ok'])
        self.assertAlmostEqual(exact['missingAreaM2'], 0, delta=.01)
        solid = check(model_from(box(*fp.bounds)), fp)
        self.assertFalse(solid['ok'])
        self.assertGreater(solid['spillPct'], 50)

    def test_epsg2154_model_matches_scene_model(self):
        """Le même toit exprimé en EPSG:2154 relatif (converti par PROJ) donne
        le même rapport que sa version en coordonnées de scène."""
        from pyproj import Transformer
        fp = V.footprint_from_building(V.load_building('BATIMENT0000000245157267'))
        scene = model_from(fp, y=40)
        to_l93 = Transformer.from_crs('EPSG:4326', 'EPSG:2154', always_xy=True)
        P = scene['parts'][0]['positions']
        pts = [to_l93.transform(*V.unproject(P[i], P[i + 2])) for i in range(0, len(P), 3)]
        origin = [round(pts[0][0]), round(pts[0][1]), 75]
        rel = []
        for (e, n) in pts:
            rel += [e - origin[0], n - origin[1], 0]
        l93 = {'coordinates': 'epsg2154-relative', 'originL93': origin,
               'parts': [{'positions': rel, 'indices': scene['parts'][0]['indices']}]}
        a, b = check(scene, fp), check(l93, fp)
        self.assertTrue(a['ok'] and b['ok'])
        self.assertAlmostEqual(a['missingAreaM2'], b['missingAreaM2'], delta=.05)
        self.assertAlmostEqual(V.projection(l93).area, V.projection(scene).area, delta=.05)
        y = V.scene_positions(l93)[0][1]
        self.assertAlmostEqual(y, 75 - 35.0, places=6)


class CertificationProcedure(unittest.TestCase):
    """Le rapport exact est EXIGÉ : lié au fichier publié et à l'emprise."""
    def test_report_binds_file_footprint_and_tolerance(self):
        import json, tempfile
        fp = V.footprint_from_building(V.load_building('BATIMENT0000000245157267'))
        model = model_from(fp)
        raw = json.dumps(model).encode()
        with tempfile.TemporaryDirectory() as d:
            path = Path(d) / 'm.json'
            out = Path(d) / 'r.json'
            path.write_bytes(raw)
            code = V.main(['--model', str(path), '--ign-id', 'BATIMENT0000000245157267',
                           '--tolerance', '1', '--tolerance-source', SRC, '--out', str(out)])
            self.assertEqual(code, 0)
            rep = json.loads(out.read_text())
        ids = {'BATIMENT0000000245157267'}
        self.assertEqual(V.check_certification_report(rep, raw, ids), [])
        self.assertTrue(V.check_certification_report(rep, raw + b' ', ids),
                        'fichier modifié après validation')
        self.assertTrue(V.check_certification_report({**rep, 'ok': False}, raw, ids))
        self.assertTrue(V.check_certification_report({**rep, 'toleranceSource': ''}, raw, ids))
        self.assertTrue(V.check_certification_report(rep, raw, {'BATIMENT0000000000000001'}))

    def test_every_certification_in_repository_has_a_valid_report(self):
        """Aucune partie certifiée ni publication sans rapport exact valide ;
        aucun modèle de test dans l'index public."""
        import json
        arch = ROOT / 'public/data/metropole/architecture'
        table = json.loads((arch / 'heritage-footprints.json').read_text())
        ign = {e['ref']: set(e['ignIds']) for e in table['entries']}
        dossiers = json.loads((arch / 'dossiers.json').read_text())['dossiers']
        index = json.loads((arch / 'models/index.json').read_text())
        for d in dossiers:
            parts = d.get('certifiedParts', [])
            if d.get('publicationAllowed'):
                parts = parts + [d.get('certification') or {}]
            for part in parts:
                report = part.get('geometryReport')
                self.assertTrue(report, d['ref'] + ' : rapport exact manquant')
                rep = json.loads((ROOT / report).read_text())
                raw = (ROOT / rep['model']).read_bytes()
                self.assertEqual(V.check_certification_report(rep, raw, ign.get(d['ref'], set())), [])
        for m in index['models']:
            self.assertNotIn('test-fixture', json.dumps(m))
            if m.get('replacement') == 'partial':
                d = next(x for x in dossiers if x['ref'] == m['ref'])
                self.assertIn(m['partId'], [p['partId'] for p in d.get('certifiedParts', [])])

if __name__ == '__main__':
    unittest.main()
