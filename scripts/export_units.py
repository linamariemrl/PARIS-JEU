#!/usr/bin/env python3
"""Unités exportables : chaque bâtiment et chaque dalle de sol de la maquette
devient un paquet autonome, soumis un par un à un outil d'enrichissement
graphique externe (voir docs/UNITES_EXPORT.md et schemas/unite-v1.schema.json).

Une unité = un dossier :
  unite.json   identité, version de base, géoréférencement (EPSG:2154 + NGF,
               WGS84, repère du jeu), géométrie de base, attributs sourcés,
               liens vers les unités voisines, sources gratuites à consulter ;
  base.glb     maquette de base (glTF 2.0) dans le repère local de l'unité.

Identifiants permanents :
  bat:<identifiant IGN BD TOPO>   ex. bat:BATIMENT0000000245157267
  sol:<ix>_<iz>                   dalle de 200 m alignée sur la grille RGE ALTI

Usage :
  python scripts/export_units.py --bat BATIMENT0000000245157267
  python scripts/export_units.py --sol 0_-2
  python scripts/export_units.py --zone 2.3499,48.8530,150   (lon,lat,rayon m)
  python scripts/export_units.py --catalogue                 (index de toutes les unités)
Sortie par défaut : export/unites/ (hors dépôt, ignoré par git).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'public/data/metropole'
OUT = ROOT / 'export/unites'
LON, LAT = 2.3537, 48.8545
MX = 111320 * math.cos(math.radians(LAT))
MZ = 111132
TILE = 800        # tuiles de bâtiments du jeu
SOL = 200         # dalles de sol = mailles de la grille RGE ALTI
SOL_STEP = 10     # échantillonnage du relief dans une dalle
SCHEMA = 'paris-unite/1'

# --- Lambert-93 (EPSG:2154), GRS80 — mêmes paramètres que src/registration.ts
A, F = 6378137.0, 1 / 298.257222101
E2 = F * (2 - F)
E = math.sqrt(E2)
LAT1, LAT2, LAT0 = map(math.radians, (44, 49, 46.5))
LON0, X0, Y0 = math.radians(3), 700000.0, 6600000.0


def _m(p):
    return math.cos(p) / math.sqrt(1 - E2 * math.sin(p) ** 2)


def _t(p):
    return math.tan(math.pi / 4 - p / 2) / ((1 - E * math.sin(p)) / (1 + E * math.sin(p))) ** (E / 2)


N = (math.log(_m(LAT1)) - math.log(_m(LAT2))) / (math.log(_t(LAT1)) - math.log(_t(LAT2)))
FF = _m(LAT1) / (N * _t(LAT1) ** N)
R0 = A * FF * _t(LAT0) ** N


def l93(lon: float, lat: float) -> tuple[float, float]:
    r = A * FF * _t(math.radians(lat)) ** N
    th = N * (math.radians(lon) - LON0)
    return X0 + r * math.sin(th), Y0 + R0 - r * math.cos(th)


def lonlat(x: float, z: float) -> tuple[float, float]:
    """Repère du jeu -> WGS84 (convention des scripts prepare_*)."""
    return LON + x / MX, LAT + z / MZ


def game_xz(lon: float, lat: float) -> tuple[float, float]:
    return (lon - LON) * MX, (lat - LAT) * MZ


# --- Données sources --------------------------------------------------------

@lru_cache(maxsize=None)
def manifest():
    return json.loads((DATA / 'buildings/manifest.json').read_text(encoding='utf-8'))


@lru_cache(maxsize=64)
def tile(tid: str) -> list[dict]:
    path = DATA / 'buildings/tiles' / f'{tid}.json'
    return json.loads(path.read_text(encoding='utf-8'))['buildings'] if path.exists() else []


@lru_cache(maxsize=None)
def quartier_4e() -> dict[str, tuple[str, dict]]:
    """Le 4e est stocké à part (WGS84, tuiles 300 m) : normalisé dans le repère du jeu."""
    out = {}
    for path in sorted((ROOT / 'public/data/4e/tiles').glob('*.json')):
        for b in json.loads(path.read_text(encoding='utf-8'))['buildings']:
            nb = dict(b)
            nb['polygons'] = [[[[round(c, 2) for c in game_xz(lon, lat)] for lon, lat in ring]
                               for ring in poly] for poly in b['polygons']]
            out[b['id']] = ('4e:' + path.stem, nb)
    return out


@lru_cache(maxsize=None)
def extras_4e() -> dict[str, dict]:
    """Attributs sourcés propres au 4e (toits LiDAR HD, formes OSM, matériaux fonciers)."""
    out: dict[str, dict] = {}
    for name, key in (('roof-lidar', 'toitLidarHD'), ('roof-shapes', 'formeToitOSM'),
                      ('materials', 'materiaux')):
        doc = json.loads((ROOT / f'public/data/4e/{name}.json').read_text(encoding='utf-8'))
        by = doc.get('byId') or {}
        if not by and isinstance(doc.get('buildings'), dict):
            by = doc['buildings']
        for i, v in by.items():
            item = {'valeur': v, 'source': doc.get('source'), 'licence': doc.get('license')}
            if key == 'toitLidarHD':
                item['repere'] = 'sommets [x, z, hauteur au-dessus du sol (MNH)] dans le repère du jeu'
            out.setdefault(i, {})[key] = item
    return out


def all_buildings():
    for t in manifest()['tiles']:
        for b in tile(t['id']):
            yield t['id'], b
    yield from quartier_4e().values()


class Terrain:
    def __init__(self):
        self.meta = json.loads((DATA / 'terrain/manifest.json').read_text(encoding='utf-8'))
        raw = (DATA / 'terrain/elevation.bin').read_bytes()
        self.v = struct.unpack('<%dh' % (len(raw) // 2), raw)
        self.ref = self.meta['displayReferenceAltitudeM']

    def altitude(self, x: float, z: float) -> float | None:
        """Altitude NGF (m), interpolation bilinéaire de la grille 200 m (comme src/terrain.ts)."""
        ext, step = self.meta['extent'], self.meta['gridSpacingMeters']
        tx, tz = (x - ext['x']) / step, (z - ext['z']) / step
        if tx < 0 or tz < 0 or tx >= ext['width'] - 1 or tz >= ext['height'] - 1:
            return None
        ix, iz = int(tx), int(tz)
        a, b = tx - ix, tz - iz
        w = ext['width']
        i, j = iz * w + ix, (iz + 1) * w + ix
        p = (self.v[i], self.v[i + 1], self.v[j], self.v[j + 1])
        if -32768 in p:
            return None
        h = p[0] * (1 - a) * (1 - b) + p[1] * a * (1 - b) + p[2] * (1 - a) * b + p[3] * a * b
        return round(h * .1 + self.ref, 2)


@lru_cache(maxsize=None)
def terrain() -> Terrain:
    return Terrain()


@lru_cache(maxsize=None)
def heritage():
    doc = json.loads((DATA / 'architecture/heritage-footprints.json').read_text(encoding='utf-8'))
    by_ign: dict[str, list[str]] = {}
    for e in doc['entries']:
        for i in e.get('ignIds', []) + e.get('parts', []):
            by_ign.setdefault(i if isinstance(i, str) else i.get('id', ''), []).append(e['ref'])
    majors = set()
    src = (ROOT / 'src/heritagePriorities.ts').read_text(encoding='utf-8')
    import re
    majors.update(re.findall(r"""["']((?:PA|IA)[0-9A-Z]{6,9})["']""", src))
    return by_ign, majors


@lru_cache(maxsize=None)
def surfaces():
    out = {}
    for name in ('roads', 'water', 'green'):
        doc = json.loads((DATA / f'surfaces/{name}.json').read_text(encoding='utf-8'))
        out[name] = (doc, [(f, bbox_of(f['polygons'])) for f in doc['features']])
    return out


def bbox_of(polys):
    xs = [p[0] for poly in polys for ring in poly for p in ring]
    zs = [p[1] for poly in polys for ring in poly for p in ring]
    return min(xs), min(zs), max(xs), max(zs)


def trees_in(x0, z0, x1, z1):
    out = []
    for ix in range(math.floor(x0 / TILE), math.floor(x1 / TILE) + 1):
        for iz in range(math.floor(z0 / TILE), math.floor(z1 / TILE) + 1):
            path = DATA / 'trees' / f'{ix}_{iz}.bin'
            if not path.exists():
                continue
            raw = path.read_bytes()
            for k in range(0, len(raw) - len(raw) % 7, 7):
                xx, zz, code, _tone, _r = struct.unpack_from('<hhBBB', raw, k)
                x, z = ix * TILE + xx * .25, iz * TILE + zz * .25
                if x0 <= x < x1 and z0 <= z < z1:
                    out.append({'x': round(x, 2), 'z': round(z, 2), 'hauteurM': round(code / 4, 2)})
    for t in trees_4e():
        if x0 <= t['x'] < x1 and z0 <= t['z'] < z1:
            out.append({'x': t['x'], 'z': t['z'], 'hauteurM': t['h'],
                        **({'genre': t['genre']} if t.get('genre') else {}),
                        **({'hauteurEstimee': True} if t.get('estimated') else {})})
    return out


@lru_cache(maxsize=None)
def trees_4e():
    return json.loads((ROOT / 'public/data/4e/trees.json').read_text(encoding='utf-8'))['trees']


# --- Géométrie --------------------------------------------------------------

def triangulate(rings: list[list[list[float]]]) -> list[tuple[int, int, int]] | None:
    """Triangulation contrainte (Shapely ≥ 2.1). Indices dans la concaténation des anneaux."""
    try:
        import shapely
        from shapely.geometry import Polygon
    except ImportError:
        return None
    if not hasattr(shapely, 'constrained_delaunay_triangles'):
        return None
    pts = [tuple(p) for ring in rings for p in ring[:-1]]
    index = {p: i for i, p in enumerate(pts)}
    poly = Polygon(rings[0], rings[1:])
    if not poly.is_valid:
        poly = poly.buffer(0)
        if poly.geom_type != 'Polygon':
            return None
    tris = []
    for t in shapely.constrained_delaunay_triangles(poly).geoms:
        c = [tuple(v) for v in t.exterior.coords[:3]]
        if all(v in index for v in c):
            tris.append(tuple(index[v] for v in c))
    return tris or None


def glb(positions: list[tuple[float, float, float]], triangles: list[tuple[int, int, int]],
        name: str, extras: dict) -> bytes:
    """glTF 2.0 binaire minimal : un maillage, Y vers le haut, mètres."""
    pos = b''.join(struct.pack('<3f', *p) for p in positions)
    big = len(positions) > 65535
    idx = b''.join(struct.pack('<3I' if big else '<3H', *t) for t in triangles)
    idx += b'\0' * (-len(idx) % 4)
    lo = [min(p[i] for p in positions) for i in range(3)]
    hi = [max(p[i] for p in positions) for i in range(3)]
    gltf = {
        'asset': {'version': '2.0', 'generator': 'PARIS export_units.py'},
        'scene': 0, 'scenes': [{'nodes': [0]}],
        'nodes': [{'mesh': 0, 'name': name, 'extras': extras}],
        'meshes': [{'name': name, 'primitives': [{'attributes': {'POSITION': 0}, 'indices': 1, 'material': 0}]}],
        'materials': [{'name': 'maquette-base', 'pbrMetallicRoughness': {
            'baseColorFactor': [.86, .86, .84, 1], 'metallicFactor': 0, 'roughnessFactor': 1}}],
        'buffers': [{'byteLength': len(pos) + len(idx)}],
        'bufferViews': [{'buffer': 0, 'byteOffset': 0, 'byteLength': len(pos), 'target': 34962},
                        {'buffer': 0, 'byteOffset': len(pos), 'byteLength': len(idx), 'target': 34963}],
        'accessors': [{'bufferView': 0, 'componentType': 5126, 'count': len(positions), 'type': 'VEC3',
                       'min': lo, 'max': hi},
                      {'bufferView': 1, 'componentType': 5125 if big else 5123,
                       'count': 3 * len(triangles), 'type': 'SCALAR'}],
    }
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * (-len(js) % 4)
    body = pos + idx
    total = 12 + 8 + len(js) + 8 + len(body)
    return (struct.pack('<4sII', b'glTF', 2, total) + struct.pack('<I4s', len(js), b'JSON') + js +
            struct.pack('<I4s', len(body), b'BIN\0') + body)


def local_frame(anchor_e, anchor_n, anchor_alt):
    """Repère local de l'unité : X = est, Y = haut, Z = sud (glTF, main droite)."""
    def f(x, z, alt):
        e, n = l93(*lonlat(x, z))
        return (round(e - anchor_e, 3), round(alt - anchor_alt, 3), round(-(n - anchor_n), 3))
    return f


def digest(obj) -> str:
    return 'sha256:' + hashlib.sha256(json.dumps(obj, sort_keys=True, separators=(',', ':'))
                                      .encode()).hexdigest()[:16]


# --- Sources gratuites (pointeurs, rien n'est téléchargé ici) ---------------

def free_sources(e0, n0, e1, n1) -> list[dict]:
    w, h = max(1, round((e1 - e0) / .2)), max(1, round((n1 - n0) / .2))
    bbox = f'{e0:.2f},{n0:.2f},{e1:.2f},{n1:.2f}'
    km = sorted({(math.floor(e / 1000), math.ceil(n / 1000)) for e in (e0, e1 - .01) for n in (n0 + .01, n1)})
    wms = 'https://data.geopf.fr/wms-r?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap&STYLES=&CRS=EPSG:2154'
    return [
        {'id': 'ign-bd-ortho', 'nature': 'orthophotographie 20 cm (couleur)', 'licence': 'Licence Ouverte 2.0',
         'url': f'{wms}&LAYERS=ORTHOIMAGERY.ORTHOPHOTOS.BDORTHO&FORMAT=image/jpeg&BBOX={bbox}&WIDTH={w}&HEIGHT={h}'},
        {'id': 'ign-ortho-irc', 'nature': 'orthophotographie infrarouge couleur 20 cm (végétation)',
         'licence': 'Licence Ouverte 2.0',
         'url': f'{wms}&LAYERS=ORTHOIMAGERY.ORTHOPHOTOS.IRC&FORMAT=image/jpeg&BBOX={bbox}&WIDTH={w}&HEIGHT={h}'},
        {'id': 'ign-lidar-hd', 'nature': 'nuage de points classé (COPC) + MNT/MNS/MNH 50 cm',
         'licence': 'Licence Ouverte 2.0',
         'dalles1km': ['LHD_FXX_%04d_%04d' % k for k in km],
         'index': 'https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature'
                  '&TYPENAMES=IGNF_LIDAR-HD_METADONNEE:metadata&OUTPUTFORMAT=application/json'
                  f'&BBOX={bbox},EPSG:2154',
         'note': "l'index renvoie url_npl (nuage), url_mnt, url_mns, url_mnh pour chaque dalle"},
        {'id': 'ign-bd-topo', 'nature': 'bâtiments vectoriels (hauteurs, altitudes sol/toit, usages)',
         'licence': 'Licence Ouverte 2.0',
         'url': 'https://data.geopf.fr/wfs/ows?SERVICE=WFS&VERSION=2.0.0&REQUEST=GetFeature'
                f'&TYPENAMES=BDTOPO_V3:batiment&OUTPUTFORMAT=application/json&BBOX={bbox},EPSG:2154'},
        {'id': 'sentinel-2', 'nature': 'imagerie satellite 10 m multispectrale (saisons, couleur des toits)',
         'licence': 'Copernicus, accès libre et gratuit',
         'url': 'https://dataspace.copernicus.eu/'},
    ]


INTERDITS = ['Google Earth / Maps / Street View', 'Apple Plans', 'Bing Maps', 'toute source sans licence explicite']


# --- Unités -----------------------------------------------------------------

def find_building(ign_id: str) -> tuple[str, dict] | None:
    if ign_id in quartier_4e():
        return quartier_4e()[ign_id]
    for tid, b in all_buildings():
        if b['id'] == ign_id:
            return tid, b
    return None


def buildings_near(x0, z0, x1, z1):
    for tx in range(math.floor(x0 / TILE), math.floor(x1 / TILE) + 1):
        for tz in range(math.floor(z0 / TILE), math.floor(z1 / TILE) + 1):
            yield from ((f'{tx}_{tz}', b) for b in tile(f'{tx}_{tz}'))
    for tid, b in quartier_4e().values():
        xs = [p[0] for poly in b['polygons'] for ring in poly for p in ring]
        zs = [p[1] for poly in b['polygons'] for ring in poly for p in ring]
        if max(xs) >= x0 and min(xs) <= x1 and max(zs) >= z0 and min(zs) <= z1:
            yield tid, b


def building_unit(tid: str, b: dict) -> tuple[dict, bytes | None]:
    ter = terrain()
    pts = [p for poly in b['polygons'] for ring in poly for p in ring]
    alts = [a for a in (ter.altitude(x, z) for x, z in pts) if a is not None]
    sol = min(alts) if alts else None
    cx = sum(p[0] for p in pts) / len(pts)
    cz = sum(p[1] for p in pts) / len(pts)
    lon_c, lat_c = lonlat(cx, cz)
    e0, n0 = l93(lon_c, lat_c)
    base = round(sol if sol is not None else ter.ref, 2)
    to_local = local_frame(e0, n0, base)
    by_ign, majors = heritage()
    refs = sorted(set(by_ign.get(b['id'], [])))
    poly_wgs = [[[list(map(lambda v: round(v, 8), lonlat(x, z))) for x, z in ring] for ring in poly]
                for poly in b['polygons']]
    poly_l93 = [[[[round(c, 3) for c in l93(*lonlat(x, z))] for x, z in ring] for ring in poly]
                for poly in b['polygons']]
    es = [p[0] for poly in poly_l93 for ring in poly for p in ring]
    ns = [p[1] for poly in poly_l93 for ring in poly for p in ring]
    geometry = {'emprise': b['polygons'], 'hauteurM': b['height']}
    # Maquette de base : extrusion plate de l'emprise IGN (toit non modélisé).
    positions, triangles = [], []
    top = b['height']
    for poly in b['polygons']:
        rings = [ring if ring[0] == ring[-1] else ring + [ring[0]] for ring in poly]
        start = len(positions)
        flat = [p for ring in rings for p in ring[:-1]]
        tris = triangulate(rings)
        if tris is None:
            continue
        for x, z in flat:
            positions.append(to_local(x, z, base + top))
        triangles += [(start + a, start + c, start + b_) for a, b_, c in tris]
        for r, ring in enumerate(rings):
            # Normales des murs vers l'extérieur du bâtiment (cour intérieure comprise).
            area = sum(xa * zb - xb * za for (xa, za), (xb, zb) in zip(ring, ring[1:]))
            sign = (1 if area > 0 else -1) * (1 if r == 0 else -1)
            for (xa, za), (xb, zb) in zip(ring, ring[1:]):
                k = len(positions)
                quad = [to_local(xa, za, base), to_local(xb, zb, base),
                        to_local(xb, zb, base + top), to_local(xa, za, base + top)]
                positions += quad
                u = [quad[1][i] - quad[0][i] for i in range(3)]
                v = [quad[2][i] - quad[0][i] for i in range(3)]
                nx, nz = u[1] * v[2] - u[2] * v[1], u[0] * v[1] - u[1] * v[0]
                # Extérieur attendu, repère local (X est, Z sud) : sign * (dz, dx).
                if nx * sign * (zb - za) + nz * sign * (xb - xa) >= 0:
                    triangles += [(k, k + 1, k + 2), (k, k + 2, k + 3)]
                else:
                    triangles += [(k, k + 2, k + 1), (k, k + 3, k + 2)]
    uid = 'bat:' + b['id']
    doc = {
        'schema': SCHEMA,
        'id': uid,
        'type': 'batiment',
        'versionBase': digest(geometry),
        'creeLe': None,
        'etat': 'base',
        'georeferencement': {
            'crs': 'EPSG:2154', 'altimetrie': 'NGF-IGN69',
            'ancre': {'e': round(e0, 3), 'n': round(n0, 3), 'altitude': base},
            'repereLocal': 'X = est, Y = haut, Z = sud ; mètres ; origine = ancre (glTF, main droite)',
            'emprise2154': poly_l93,
            'emprise4326': poly_wgs,
            'bbox2154': [round(min(es), 2), round(min(ns), 2), round(max(es), 2), round(max(ns), 2)],
            'repereJeu': {'x': round(cx, 2), 'z': round(cz, 2), 'tuile': tid,
                          'note': 'x = est, z = nord, origine lon 2.3537 lat 48.8545'},
        },
        'attributs': {
            'hauteurM': b['height'],
            'hauteurEstimee': b.get('estimatedHeight', False),
            'usage': b.get('usage'),
            'altitudeSolNGF': sol,
            'altitudeSolSource': 'RGE ALTI grille 200 m interpolée (précision métrique, à affiner par LiDAR HD)',
            'patrimoine': [{'ref': r, 'majeur': r in majors,
                            'notice': 'https://pop.culture.gouv.fr/notice/merimee/' + r} for r in refs],
            'teinte': 'beige-majeur' if any(r in majors for r in refs) else 'neutre',
            **({'complementsSources': extras_4e()[b['id']]} if b['id'] in extras_4e() else {}),
        },
        'provenance': [
            {'donnee': 'emprise, hauteur, usage', 'source': manifest()['source'],
             'url': manifest()['sourceURL'], 'licence': 'Licence Ouverte 2.0'},
            {'donnee': 'altitude du sol', 'source': 'IGN RGE ALTI', 'licence': 'Licence Ouverte 2.0'},
        ],
        'maquetteBase': {'fichier': 'base.glb' if triangles else None,
                         'contenu': 'extrusion plate de l’emprise IGN ; toiture non modélisée',
                         'sommets': len(positions), 'triangles': len(triangles)},
        'voisins': {'sol': 'sol:%d_%d' % (math.floor(cx / SOL), math.floor(cz / SOL))},
        'sourcesGratuites': free_sources(min(es) - 5, min(ns) - 5, max(es) + 5, max(ns) + 5),
        'sourcesInterdites': INTERDITS,
    }
    blob = glb(positions, triangles, uid, {'unite': uid, 'versionBase': doc['versionBase']}) if triangles else None
    return doc, blob


def ground_unit(ix: int, iz: int) -> tuple[dict, bytes]:
    from shapely.geometry import Polygon, box, mapping
    ter = terrain()
    x0, z0 = ix * SOL, iz * SOL
    x1, z1 = x0 + SOL, z0 + SOL
    n = SOL // SOL_STEP + 1
    grid = [[ter.altitude(x0 + i * SOL_STEP, z0 + j * SOL_STEP) for i in range(n)] for j in range(n)]
    valid = [a for row in grid for a in row if a is not None]
    base = round(min(valid), 2) if valid else ter.ref
    lon0, lat0 = lonlat(x0, z0)
    lon1, lat1 = lonlat(x1, z1)
    corners = [l93(*lonlat(x, z)) for x, z in ((x0, z0), (x1, z0), (x1, z1), (x0, z1))]
    e0, n0 = l93(*lonlat((x0 + x1) / 2, (z0 + z1) / 2))
    to_local = local_frame(e0, n0, base)
    cell = box(x0, z0, x1, z1)
    layers = {}
    for name, (srcdoc, feats) in surfaces().items():
        items = []
        for f, (a, b, c, d) in feats:
            if c < x0 or a > x1 or d < z0 or b > z1:
                continue
            for poly in f['polygons']:
                try:
                    g = Polygon(poly[0], poly[1:]).buffer(0).intersection(cell)
                except Exception:
                    continue
                if g.is_empty or g.area < .5:
                    continue
                gm = mapping(g)
                items.append({'nature': f['kind'], 'geometrie': json.loads(json.dumps(gm))})
        layers[name] = {'source': srcdoc.get('source'), 'licence': srcdoc.get('license'),
                        'elements': items}
    bats = []
    for _, b in buildings_near(x0, z0, x1, z1):
        pts = [p for poly in b['polygons'] for ring in poly for p in ring]
        cx = sum(p[0] for p in pts) / len(pts)
        cz = sum(p[1] for p in pts) / len(pts)
        if x0 <= cx < x1 and z0 <= cz < z1:
            bats.append('bat:' + b['id'])
    positions, triangles = [], []
    for j in range(n):
        for i in range(n):
            a = grid[j][i]
            positions.append(to_local(x0 + i * SOL_STEP, z0 + j * SOL_STEP, a if a is not None else base))
    for j in range(n - 1):
        for i in range(n - 1):
            k = j * n + i
            triangles += [(k, k + 1, k + n), (k + 1, k + n + 1, k + n)]  # face vers le haut
    uid = f'sol:{ix}_{iz}'
    content = {'relief': grid, 'surfaces': {k: len(v['elements']) for k, v in layers.items()}}
    doc = {
        'schema': SCHEMA, 'id': uid, 'type': 'sol', 'versionBase': digest(content),
        'creeLe': None, 'etat': 'base',
        'georeferencement': {
            'crs': 'EPSG:2154', 'altimetrie': 'NGF-IGN69',
            'ancre': {'e': round(e0, 3), 'n': round(n0, 3), 'altitude': base},
            'repereLocal': 'X = est, Y = haut, Z = sud ; mètres ; origine = ancre (glTF, main droite)',
            'coins2154': [[round(e, 2), round(n_, 2)] for e, n_ in corners],
            'bbox4326': [round(lon0, 7), round(lat0, 7), round(lon1, 7), round(lat1, 7)],
            'repereJeu': {'x0': x0, 'z0': z0, 'cote': SOL},
        },
        'relief': {'pasM': SOL_STEP, 'lignes': n, 'colonnes': n, 'ordre': 'lignes du sud au nord, ouest vers est',
                   'altitudesNGF': grid,
                   'source': 'IGN RGE ALTI, grille 200 m interpolée : à remplacer par le MNT LiDAR HD 50 cm'},
        'surfaces': layers,
        'arbres': {'source': 'Ville de Paris, les arbres (ODbL)', 'elements': trees_in(x0, z0, x1, z1)},
        'batiments': sorted(bats),
        'maquetteBase': {'fichier': 'base.glb', 'contenu': 'relief seul (surfaces et arbres en données)',
                         'sommets': len(positions), 'triangles': len(triangles)},
        'voisins': {d: 'sol:%d_%d' % (ix + dx, iz + dz) for d, dx, dz in
                    (('nord', 0, 1), ('sud', 0, -1), ('est', 1, 0), ('ouest', -1, 0))},
        'sourcesGratuites': free_sources(min(c[0] for c in corners), min(c[1] for c in corners),
                                         max(c[0] for c in corners), max(c[1] for c in corners)),
        'sourcesInterdites': INTERDITS,
    }
    return doc, glb(positions, triangles, uid, {'unite': uid, 'versionBase': doc['versionBase']})


def write(doc: dict, blob: bytes | None, out: Path, stamp: str) -> Path:
    d = out / doc['id'].replace(':', '/')
    d.mkdir(parents=True, exist_ok=True)
    doc['creeLe'] = stamp
    (d / 'unite.json').write_text(json.dumps(doc, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    if blob:
        (d / 'base.glb').write_bytes(blob)
    return d


def catalogue(out: Path, stamp: str) -> dict:
    """Index de toutes les unités (sans les exporter) : id, tuile, centre, version."""
    rows, cells = [], set()
    for tid, b in all_buildings():
        pts = [p for poly in b['polygons'] for ring in poly for p in ring]
        cx = sum(p[0] for p in pts) / len(pts)
        cz = sum(p[1] for p in pts) / len(pts)
        rows.append(['bat:' + b['id'], tid, round(cx, 1), round(cz, 1),
                     digest({'emprise': b['polygons'], 'hauteurM': b['height']})])
        cells.add((math.floor(cx / SOL), math.floor(cz / SOL)))
    # Dalles de sol : toutes celles qui touchent Paris et les 29 communes limitrophes.
    import shapely
    from shapely.geometry import box, shape
    from shapely.ops import unary_union
    from shapely.prepared import prep
    lim = json.loads((DATA / 'limits.geojson').read_text(encoding='utf-8'))
    to_game = lambda c: (c - (LON, LAT)) * (MX, MZ)  # noqa: E731
    area = unary_union([shapely.transform(shape(f['geometry']), to_game)
                        for f in lim['features'] if f['properties'].get('kind') in ('paris', 'commune_limitrophe')])
    pa = prep(area)
    a0, b0, a1, b1 = area.bounds
    for i in range(math.floor(a0 / SOL), math.floor(a1 / SOL) + 1):
        for j in range(math.floor(b0 / SOL), math.floor(b1 / SOL) + 1):
            if pa.intersects(box(i * SOL, j * SOL, (i + 1) * SOL, (j + 1) * SOL)):
                cells.add((i, j))
    doc = {'schema': SCHEMA + '/catalogue', 'creeLe': stamp,
           'colonnes': ['id', 'tuileJeu', 'x', 'z', 'versionBase'],
           'batiments': rows, 'sols': sorted('sol:%d_%d' % c for c in cells)}
    out.mkdir(parents=True, exist_ok=True)
    (out / 'catalogue.json').write_text(json.dumps(doc, ensure_ascii=False, separators=(',', ':')) + '\n',
                                        encoding='utf-8')
    return doc


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--bat', action='append', default=[], help='identifiant IGN (BATIMENT…)')
    ap.add_argument('--sol', action='append', default=[], help='dalle ix_iz (200 m)')
    ap.add_argument('--zone', help='lon,lat,rayon : bâtiments et dalles de sol de la zone')
    ap.add_argument('--catalogue', action='store_true')
    ap.add_argument('--sortie', type=Path, default=OUT)
    a = ap.parse_args(argv)
    stamp = datetime.now(timezone.utc).isoformat(timespec='seconds')
    written = []
    if a.catalogue:
        c = catalogue(a.sortie, stamp)
        print('catalogue :', len(c['batiments']), 'bâtiments,', len(c['sols']), 'dalles de sol')
    bats = list(a.bat)
    sols = [tuple(map(int, s.split('_'))) for s in a.sol]
    if a.zone:
        lon, lat, r = map(float, a.zone.split(','))
        x, z = game_xz(lon, lat)
        for _, b in buildings_near(x - r, z - r, x + r, z + r):
            if any(math.hypot(p[0] - x, p[1] - z) <= r
                   for poly in b['polygons'] for ring in poly for p in ring):
                bats.append(b['id'])
        sols += [(i, j) for i in range(math.floor((x - r) / SOL), math.floor((x + r) / SOL) + 1)
                 for j in range(math.floor((z - r) / SOL), math.floor((z + r) / SOL) + 1)]
    for ign in dict.fromkeys(bats):
        found = find_building(ign)
        if not found:
            print('introuvable :', ign)
            continue
        written.append(write(*building_unit(*found), a.sortie, stamp))
    for ix, iz in dict.fromkeys(sols):
        written.append(write(*ground_unit(ix, iz), a.sortie, stamp))
    for d in written:
        print(d.relative_to(ROOT) if d.is_relative_to(ROOT) else d)
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
