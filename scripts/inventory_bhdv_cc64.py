"""Inventaire des planches du recueil BHdV CC64 (ark:/73873/pf0000712758).

Interroge la Bibliothèque de l'Hôtel de Ville (réseau requis) et consigne,
pour chaque planche : numéro, ARK, titre du catalogue, image Deep Zoom et
dimensions en pixels, assises mentionnées dans le TITRE. Rien n'est lu sur
les images ici : c'est un plan de lecture, pas une mesure.

Usage : python scripts/inventory_bhdv_cc64.py [nombre_de_planches]
"""
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'public/data/metropole/architecture/measurements/PA00086319-sources-cc64.json'
BASE = 'https://bibliotheques-specialisees.paris.fr'
ARK = '73873/pf0000712758'


def get(url):
    r = subprocess.run(['curl', '-sf', '--max-time', '30', url],
                       capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else ''


def courses(title):
    """Numéros d'assise cités par le titre, avec leur système de numérotation."""
    low = title.lower()
    system = ('au-dessus-du-corgoloin' if 'corgoloin' in low else
              'socle' if 'socle' in low else 'non-precise')
    nums = set()
    for a, b in re.findall(r'(\d+)(?:e|ère|ème)?\s*(?:à|a)\s*(?:la\s*)?(\d+)e', low):
        nums.update(range(int(a), int(b) + 1))
    for n in re.findall(r'(\d+)\s*(?:e|ère|ème|me)\b', low):
        nums.add(int(n))
    return {'numbers': sorted(n for n in nums if n < 40), 'numbering': system}


def main(count=40):
    plates = []
    for i in range(1, count + 1):
        n = f'{i:04d}'
        html = get(f'{BASE}/in/imageReader.xhtml?ark={ARK.replace("/", "%2F")}%2F{n}%2Fv0001'
                   f'&id=ark%3A%2F{ARK.replace("/", "%2F")}%2F{n}&updateUrl=updateUrl')
        t = re.search(r'<title>([^<]*)</title>', html)
        dz = re.search(r'/in/dz/[^"\' ]*\.xml', html)
        if not t or not dz:
            continue
        title = t.group(1).replace(' - Reader', '').strip()
        xml = get(BASE + dz.group(0))
        w = re.search(r'Width="(\d+)"', xml)
        h = re.search(r'Height="(\d+)"', xml)
        plates.append({
            'plate': i, 'ark': f'ark:/{ARK}/{n}', 'title': title,
            'deepZoom': BASE + dz.group(0),
            'pixels': [int(w.group(1)), int(h.group(1))] if w and h else None,
            'facadeOnPlace': 'place de l' in title.lower(),
            'coursesInTitle': courses(title),
            'transcribed': i == 34})
    doc = {'schema': 1, 'ref': 'PA00086319', 'collection': f'ark:/{ARK}',
           'generatedBy': 'scripts/inventory_bhdv_cc64.py',
           'note': ('Titres du catalogue BHdV, non vérifiés sur les images. Deux '
                    'numérotations coexistent : assises de socle et assises '
                    'au-dessus de l\'assise en Corgoloin ; ne pas les additionner '
                    'sans avoir établi leur correspondance.'),
           'plates': plates}
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + '\n', encoding='utf-8')
    print(len(plates), 'planches,', sum(p['facadeOnPlace'] for p in plates),
          'concernant la façade sur la place')


if __name__ == '__main__':
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 40)
