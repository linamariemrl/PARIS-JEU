"""Unités exportables (bâtiments, dalles de sol) et contrôle des retours enrichis."""
import importlib.util
import json
import math
import shutil
import tempfile
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NOTRE_DAME = 'BATIMENT0000000305564422'


def load(name):
    spec = importlib.util.spec_from_file_location(name, ROOT / f'scripts/{name}.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class Units(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        try:
            import shapely
        except ImportError:
            raise unittest.SkipTest('shapely >= 2.1 requis (installé par release-validation)')
        if not hasattr(shapely, 'constrained_delaunay_triangles'):
            raise unittest.SkipTest('shapely >= 2.1 requis')
        cls.u = load('export_units')
        cls.c = load('check_unit_return')
        cls.tmp = Path(tempfile.mkdtemp())
        cls.base = cls.tmp / 'unites'
        cls.u.main(['--bat', NOTRE_DAME, '--sol=-2_-1', '--sortie', str(cls.base)])
        cls.bat = json.loads((cls.base / 'bat' / NOTRE_DAME / 'unite.json').read_text(encoding='utf-8'))
        cls.sol = json.loads((cls.base / 'sol/-2_-1/unite.json').read_text(encoding='utf-8'))

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp)

    def test_lambert93_matches_reference(self):
        # Valeurs de référence pyproj (EPSG:4326 -> EPSG:2154).
        e, n = self.u.l93(2.35, 48.853)
        self.assertAlmostEqual(e, 652304.311, places=2)
        self.assertAlmostEqual(n, 6861636.298, places=2)
        try:
            import pyproj
        except ImportError:
            return
        t = pyproj.Transformer.from_crs(4326, 2154, always_xy=True)
        for lon, lat in ((2.25, 48.82), (2.41, 48.9), (2.3537, 48.8545)):
            self.assertLess(math.dist(self.u.l93(lon, lat), t.transform(lon, lat)), .001)

    def test_building_unit_is_self_contained_and_sourced(self):
        b = self.bat
        self.assertEqual(b['schema'], 'paris-unite/1')
        self.assertEqual(b['id'], 'bat:' + NOTRE_DAME)
        self.assertTrue(b['versionBase'].startswith('sha256:'))
        self.assertEqual(b['georeferencement']['crs'], 'EPSG:2154')
        self.assertEqual(b['attributs']['patrimoine'][0]['ref'], 'PA00086250')
        self.assertTrue(b['attributs']['patrimoine'][0]['majeur'])
        self.assertEqual(b['attributs']['teinte'], 'beige-majeur')
        self.assertEqual(b['voisins']['sol'], 'sol:-2_-1')
        self.assertIn('bat:' + NOTRE_DAME, self.sol['batiments'])
        ids = {s['id'] for s in b['sourcesGratuites']}
        self.assertTrue({'ign-bd-ortho', 'ign-lidar-hd', 'ign-bd-topo'} <= ids)
        self.assertIn('LHD_FXX_0652_6862', b['sourcesGratuites'][2]['dalles1km'])
        self.assertTrue(any('Google' in s for s in b['sourcesInterdites']))
        for s in b['sourcesGratuites']:
            self.assertTrue(s['licence'])

    def test_base_model_is_valid_gltf_in_the_local_frame(self):
        gltf, _ = self.c.read_glb(self.base / 'bat' / NOTRE_DAME / 'base.glb')
        lo, hi = self.c.position_bounds(gltf)
        g = self.bat['georeferencement']
        e0, n0, e1, n1 = g['bbox2154']
        a = g['ancre']
        self.assertAlmostEqual(lo[0], e0 - a['e'], delta=.01)
        self.assertAlmostEqual(hi[0], e1 - a['e'], delta=.01)
        self.assertAlmostEqual(lo[2], -(n1 - a['n']), delta=.01)
        self.assertAlmostEqual(hi[2], -(n0 - a['n']), delta=.01)
        self.assertAlmostEqual(lo[1], 0, delta=.01)
        self.assertAlmostEqual(hi[1], self.bat['attributs']['hauteurM'], delta=.01)
        self.assertEqual(self.c.triangles(gltf), self.bat['maquetteBase']['triangles'])

    def test_faces_point_outwards(self):
        import struct
        from shapely.geometry import Point, Polygon
        gltf, blob = self.c.read_glb(self.base / 'bat' / NOTRE_DAME / 'base.glb')
        n = gltf['accessors'][0]['count']
        P = [struct.unpack_from('<3f', blob, 12 * i) for i in range(n)]
        off = gltf['bufferViews'][1]['byteOffset']
        idx = [struct.unpack_from('<H', blob, off + 2 * i)[0] for i in range(gltf['accessors'][1]['count'])]
        a = self.bat['georeferencement']['ancre']
        loc = lambda ring: [(e - a['e'], -(nn - a['n'])) for e, nn in ring]  # noqa: E731
        polys = [Polygon(loc(p[0]), [loc(r) for r in p[1:]]) for p in self.bat['georeferencement']['emprise2154']]
        for k in range(0, len(idx), 3):
            A, B, C = P[idx[k]], P[idx[k + 1]], P[idx[k + 2]]
            U = [B[i] - A[i] for i in range(3)]
            V = [C[i] - A[i] for i in range(3)]
            N = (U[1] * V[2] - U[2] * V[1], U[2] * V[0] - U[0] * V[2], U[0] * V[1] - U[1] * V[0])
            if abs(N[1]) > abs(N[0]) + abs(N[2]):
                self.assertGreater(N[1], 0, 'toit tourné vers le bas')
                continue
            L = math.hypot(N[0], N[2])
            probe = Point((A[0] + B[0] + C[0]) / 3 + N[0] / L * .05, (A[2] + B[2] + C[2]) / 3 + N[2] / L * .05)
            self.assertFalse(any(p.contains(probe) for p in polys), 'mur tourné vers l’intérieur')

    def test_ground_unit_has_relief_surfaces_trees_and_neighbours(self):
        s = self.sol
        n = s['relief']['lignes']
        self.assertEqual(n, 21)
        self.assertEqual(len(s['relief']['altitudesNGF']), n)
        self.assertTrue(all(isinstance(v, float) for row in s['relief']['altitudesNGF'] for v in row))
        self.assertGreater(len(s['surfaces']['roads']['elements']), 0)
        self.assertGreater(len(s['arbres']['elements']), 0)
        self.assertEqual(s['voisins']['nord'], 'sol:-2_0')
        gltf, _ = self.c.read_glb(self.base / 'sol/-2_-1/base.glb')
        self.assertEqual(self.c.triangles(gltf), 800)

    def test_ids_are_stable_versions_are_reproducible(self):
        tid, b = self.u.find_building(NOTRE_DAME)
        doc, _ = self.u.building_unit(tid, b)
        self.assertEqual(doc['versionBase'], self.bat['versionBase'])

    def _return(self, rapport=None, **change):
        ret = self.tmp / 'retour'
        shutil.rmtree(ret, ignore_errors=True)
        ret.mkdir()
        doc = json.loads(json.dumps(self.bat))
        doc['etat'] = 'enrichie'
        doc['enrichissement'] = {'outil': 'test', 'version': '1', 'date': '2026-11-11',
                                 'sources': [{'id': 'ign-bd-ortho', 'licence': 'Licence Ouverte 2.0',
                                              'url': self.bat['sourcesGratuites'][0]['url']}]}
        for k, v in change.items():
            doc[k] = v
        (ret / 'unite.json').write_text(json.dumps(doc), encoding='utf-8')
        shutil.copy(self.base / 'bat' / NOTRE_DAME / 'base.glb', ret / 'enrichi.glb')
        (ret / 'rapport-qualite.json').write_text(json.dumps(rapport or {
            'unite': doc['id'], 'versionBase': self.bat['versionBase'],
            'mesures': {'ecartLidarRmsM': .2}, 'declarations': {'toit': 'mesure-lidar', 'elementsInventes': []},
            'attributions': ['© IGN'], 'outil': {'nom': 'test'}}), encoding='utf-8')
        return ret

    def test_return_accepted_when_conform(self):
        r = self.c.check(self._return(), self.base)
        self.assertTrue(r['accepte'], r)

    def test_return_rejected_for_forbidden_source_stale_base_or_out_of_footprint(self):
        bad = {'outil': 't', 'version': '1', 'date': 'd',
               'sources': [{'id': 'earth', 'url': 'https://earth.google.com/x', 'licence': 'CC-BY'}]}
        self.assertFalse(self.c.check(self._return(enrichissement=bad), self.base)['accepte'])
        self.assertFalse(self.c.check(self._return(versionBase='sha256:0'), self.base)['accepte'])
        moved = json.loads(json.dumps(self.bat['georeferencement']))
        moved['ancre']['e'] += 50
        self.assertFalse(self.c.check(self._return(georeferencement=moved), self.base)['accepte'])

    def test_return_rejected_without_quality_report_missing_lod_or_invented_elements(self):
        ok = self._return()
        (ok / 'rapport-qualite.json').unlink()
        self.assertFalse(self.c.check(ok, self.base)['accepte'])
        lod = dict(json.loads(json.dumps(self._enr())), niveauxDeDetail=[{'fichier': 'lod1.glb'}])
        self.assertFalse(self.c.check(self._return(enrichissement=lod), self.base)['accepte'])
        invented = {'unite': 'bat:' + NOTRE_DAME, 'versionBase': self.bat['versionBase'], 'mesures': {'x': 1},
                    'declarations': {'elementsInventes': ['balcons']}, 'attributions': ['IGN'], 'outil': {'n': 1}}
        self.assertFalse(self.c.check(self._return(rapport=invented), self.base)['accepte'])

    def _enr(self):
        return {'outil': 'test', 'version': '1', 'date': '2026-11-11',
                'sources': [{'id': 'ign-bd-ortho', 'licence': 'Licence Ouverte 2.0'}]}

    def test_catalogue_covers_every_building_of_the_game(self):
        out = self.tmp / 'cat'
        doc = self.u.catalogue(out, 'test')
        total = self.u.manifest()['totalBuildings'] + len(self.u.quartier_4e())
        self.assertEqual(len(doc['batiments']), total)
        self.assertEqual(len({r[0] for r in doc['batiments']}), total, 'identifiants uniques')
        self.assertIn('sol:-2_-1', doc['sols'])


if __name__ == '__main__':
    unittest.main()
