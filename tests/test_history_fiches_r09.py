"""R09 : fiches Histoire et inventaire POP vérifié — contrôles éditoriaux automatiques.

Règle centrale : aucune information n'est ajoutée au-delà des notices POP
officielles. Le récit historique est le champ HIST, repris tel quel.
"""
import importlib.util
import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PLACES = ROOT / 'public/data/metropole/places'


def load_builder():
    spec = importlib.util.spec_from_file_location('fiches', ROOT / 'scripts/build_history_fiches.py')
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


class HistoryFiches(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.mod = load_builder()
        cls.source = json.loads((ROOT / 'data/heritage/pop-notices-paris.json').read_text(encoding='utf-8'))
        cls.notices = {n['ref']: n for n in cls.source['notices']}
        cls.index = json.loads((PLACES / 'fiches/index.json').read_text(encoding='utf-8'))
        cls.fiches = {}
        for path in (PLACES / 'fiches').glob('*.json'):
            if path.name == 'index.json':
                continue
            for f in json.loads(path.read_text(encoding='utf-8'))['fiches']:
                cls.fiches[f['ref']] = (path.stem, f)

    def test_published_files_equal_regeneration(self):
        shards, index, stats, _ = self.mod.build()
        self.assertEqual(sorted(index, key=lambda e: e['ref']), self.index['entrees'])
        self.assertEqual(stats, self.index['statistiques'])
        for key, items in shards.items():
            published = json.loads((PLACES / 'fiches' / f'{key}.json').read_text(encoding='utf-8'))
            self.assertEqual(sorted(items, key=lambda f: f['ref']), published['fiches'], key)

    def test_one_fiche_per_verified_notice_in_its_shard(self):
        self.assertEqual(set(self.fiches), set(self.notices))
        for e in self.index['entrees']:
            shard, f = self.fiches[e['ref']]
            self.assertEqual(shard, e['shard'])
            self.assertEqual(f['statut'], e['statut'])
            if e['arrondissement']:
                self.assertEqual(shard, 'arr-%02d' % e['arrondissement'])

    def test_history_is_the_official_text_never_generated(self):
        for ref, (_, f) in self.fiches.items():
            n = self.notices[ref]
            official = self.mod.clean(n.get('historique') or '')
            if official:
                self.assertEqual(f.get('historique'), official, ref)
            else:
                self.assertNotIn('historique', f, ref + ' : récit sans source')
            self.assertEqual(f['source'], 'https://pop.culture.gouv.fr/notice/merimee/' + ref)
            self.assertIn('Etalab', f['licence'])

    def test_every_landmark_sentence_comes_from_a_notice_field(self):
        for ref, (_, f) in self.fiches.items():
            n = self.notices[ref]
            values = []
            for k, v in n.items():
                if k in ('ref', 'source', 'wgs84', 'arrondissement'):
                    continue
                values += v if isinstance(v, list) else [str(v), *self.mod.as_list(v)]
            for sentence in f.get('reperes', []):
                body = sentence.split(':', 1)[1] if ':' in sentence else sentence
                found = [v for v in values if v and self.mod.clean(str(v)) in sentence]
                arr_only = re.fullmatch(r'Il se situe .*arrondissement\.', sentence)
                self.assertTrue(found or arr_only, ref + ' : repère sans champ source « ' + body + ' »')

    def test_status_matches_missing_sections(self):
        for ref, (_, f) in self.fiches.items():
            missing = f.get('manques', [])
            if f['statut'] == 'documentee':
                self.assertEqual(missing, [], ref)
            else:
                self.assertTrue(missing, ref)
            if f['statut'] in ('documentee', 'recit-officiel-partiel'):
                self.assertGreaterEqual(len(f.get('historique', '')), self.mod.HIST_MIN, ref)

    def test_all_major_monuments_have_a_fiche(self):
        majors = {e['ref'] for e in json.loads((PLACES / 'landmark-catalog.json').read_text(encoding='utf-8'))['linked']
                  if e.get('ref')}
        self.assertEqual(len(majors), 140)
        self.assertTrue(majors <= set(self.fiches))
        self.assertEqual(self.index['statistiques']['majeurs']['avecFiche'], 140)
        for ref in majors:
            self.assertTrue(self.fiches[ref][1].get('majeur'), ref)

    def test_verified_inventory_only_contains_paris(self):
        for n in self.source['notices']:
            ok = any(str(i).startswith('751') for i in n.get('insee', [])) or \
                any('Paris' in c for c in n.get('communes', []))
            self.assertTrue(ok, n['ref'])
        disc = json.loads((PLACES / 'sources/wikidata-merimee-paris.json').read_text(encoding='utf-8'))
        self.assertIn('jamais reprises de Wikidata', disc['role'])
        # Les rejets « hors Paris » prouvent que Wikidata est vérifié, pas cru.
        self.assertGreaterEqual(self.source['status'].get('hors-paris', 0), 1)
        for _, f in self.fiches.values():
            self.assertNotIn('wikidata', json.dumps(f).lower())

    def test_mobile_payload_per_arrondissement(self):
        for path in (PLACES / 'fiches').glob('*.json'):
            self.assertLess(path.stat().st_size, 450_000, path.name)
        self.assertFalse((PLACES / 'pop-notices-paris.json').exists(),
                         'le fichier intermédiaire ne doit pas être publié')


class InventoryControls(unittest.TestCase):
    """R09 lot 3 : contrôles qualité reproductibles, signalés et non corrigés en silence."""
    @classmethod
    def setUpClass(cls):
        spec = importlib.util.spec_from_file_location('audit', ROOT / 'scripts/audit_pop_inventory.py')
        cls.mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(cls.mod)
        cls.published = json.loads((ROOT / 'data/heritage/controles-pop-paris.json').read_text(encoding='utf-8'))

    def test_report_equals_regeneration(self):
        status = {r['url']: r['http'] for r in self.published['liens']}
        doc = self.mod.audit(status)
        doc['liensVerifiesLe'] = self.published['liensVerifiesLe']
        self.assertEqual(doc, self.published)
        self.assertTrue(self.published['liensVerifiesLe'])
        self.assertEqual(self.published['resume']['liensVerifies'], self.published['resume']['liens'])

    def test_invalid_pop_points_never_reach_the_map(self):
        # POP publie [0, 0] ou des latitudes erronées (43,8°) : ces points sont écartés.
        rejected = {r['ref'] for r in self.published['pointPOPinvalideEcarte']}
        self.assertGreaterEqual(len(rejected), 90)
        index = json.loads((PLACES / 'fiches/index.json').read_text(encoding='utf-8'))['entrees']
        for e in index:
            if 'x' in e:
                self.assertLess(abs(e['x']), 13_000, e['ref'])
                self.assertLess(abs(e['z']), 9_000, e['ref'])
            if e['ref'] in rejected:
                self.assertNotIn('x', e, e['ref'])
        self.assertEqual(self.published['resume']['pointJeuEloigneDuPointPOP'], 0)

    def test_aliases_and_destroyed_sites_come_from_the_notice(self):
        notices = {n['ref']: n for n in json.loads(
            (ROOT / 'data/heritage/pop-notices-paris.json').read_text(encoding='utf-8'))['notices']}
        index = json.loads((PLACES / 'fiches/index.json').read_text(encoding='utf-8'))['entrees']
        for e in index:
            n = notices[e['ref']]
            for alias in e.get('noms', []):
                self.assertIn(alias, n['appellations'])
            for state in e.get('etat', []):
                self.assertIn(state, n['etat'])
        self.assertEqual(sum(1 for e in index if e.get('etat')),
                         self.published['resume']['sitesDetruitsOuFragmentaires'])

    def test_legal_act_is_not_displayed_as_protection_level(self):
        src = (ROOT / 'src/heritageAtlas.ts').read_text(encoding='utf-8')
        self.assertNotIn("'Protection mentionnée par POP'", src)
        self.assertIn('Nature de l’acte de protection (POP)', src)


class FarMajorsBeige(unittest.TestCase):
    """Beige unique des majeurs, identique dans le LOD lointain et le panorama."""
    def test_overview_marks_exactly_the_major_footprints(self):
        overview = ROOT / 'public/data/metropole/overview/manifest.json'
        if not overview.exists():
            self.skipTest('LOD généré au déploiement (prepare_metropole_overview.py)')
        manifest = json.loads(overview.read_text(encoding='utf-8'))
        majors = json.loads((ROOT / 'public/data/metropole/overview/majors.json').read_text(encoding='utf-8'))
        marked = sum(len(g.get('majors', [])) for g in manifest['groups'])
        self.assertEqual(marked, len(majors['boxes']))
        self.assertGreaterEqual(marked, 100)
        for g in manifest['groups']:
            self.assertTrue(all(0 <= i < g['count'] for i in g.get('majors', [])))

    def test_renderer_uses_one_beige_near_and_far(self):
        # R11 : une seule source du beige (src/monumentPalette.ts), reprise
        # de près (buildings.ts), au loin et en panorama (metroOverview.ts)
        # et dans le catalogue (landmarkBrowser.ts).
        palette = (ROOT / 'src/monumentPalette.ts').read_text(encoding='utf-8')
        m = re.search(r"MONUMENT_BEIGE_HEX='#([0-9a-f]{6})'", palette)
        self.assertTrue(m)
        rgb = re.search(r'MONUMENT_BEIGE_RGB=\[(\d+)/255,(\d+)/255,(\d+)/255\]', palette)
        self.assertTrue(rgb)
        self.assertEqual(tuple(int(m.group(1)[i:i + 2], 16) for i in (0, 2, 4)),
                         tuple(int(v) for v in rgb.groups()), 'hex et RGB identiques')
        for name in ('metroOverview', 'buildings', 'landmarkBrowser'):
            code = (ROOT / f'src/{name}.ts').read_text(encoding='utf-8')
            self.assertIn("from './monumentPalette'", code, name)
            self.assertIsNone(re.search(r'\.87\s*,\s*\.80\s*,\s*\.69|#ded0b9', code, re.I),
                              name + ' : beige recopié au lieu de la source unique')
        src = (ROOT / 'src/metroOverview.ts').read_text(encoding='utf-8')
        self.assertIn("thinInstanceSetBuffer('color',colors,4,true)", src)
        self.assertIn('MAJOR_WALL=[beigeR/', src)
        self.assertIn("'monuments-majeurs-panorama'", src)
        buildings = (ROOT / 'src/buildings.ts').read_text(encoding='utf-8')
        self.assertIn('heritageWall.diffuseColor=new Color3(br,bg,bb)', buildings)
        self.assertIn('heritageRoof.diffuseColor=new Color3(br,bg,bb)', buildings)
        self.assertIn('footprints.refsOf(b.id).some(isMajorHeritageRef)', buildings)

if __name__ == '__main__':
    unittest.main()
