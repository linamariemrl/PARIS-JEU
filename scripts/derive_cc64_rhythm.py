"""Dérive le rythme de la façade (14e assise) des chaînes de cotes fermées.

Source unique : public/data/metropole/architecture/measurements/PA00086319.json
Sortie       : public/data/metropole/architecture/reference/PA00086319/
               cc64-pl34-assise14-rythme.json

Géométrie PARTIELLE et NON CERTIFIÉE : positions le long de la façade, en
mètres du dessin de 1878, depuis le bord gauche de la base de la tourelle
gauche. Ni géoréférencée, ni placée en hauteur, sans profondeurs : elle
n'est lue par aucun code du moteur. Refuse de produire quoi que ce soit si
une chaîne n'est pas fermée.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REG = ROOT / 'public/data/metropole/architecture/measurements/PA00086319.json'
OUT = (ROOT / 'public/data/metropole/architecture/reference/PA00086319/'
       'cc64-pl34-assise14-rythme.json')


def build():
    reg = json.loads(REG.read_text(encoding='utf-8'))
    chains = {c['chainId']: c for c in reg['chains']}
    left = chains['cc64-assise14-moitie-gauche']
    right = chains['cc64-assise14-moitie-droite']
    for c in (left, right):
        total = round(sum(s['value'] for s in c['segments']), 2)
        if abs(total - c['inscribedTotal']) >= 0.005:
            raise SystemExit('Chaîne non fermée : ' + c['chainId'])
    turret = next(m for m in reg['measurements']
                  if m['elementId'].endswith('tourelle/base-totale'))
    intervals, x = [], 0.0

    def add(value, element, origin):
        nonlocal x
        start = round(x, 2)
        x = round(x + value, 2)
        intervals.append({'start': start, 'end': x, 'length': value,
                          'element': element, 'from': origin})

    add(turret['value'], 'tourelle-gauche-base', turret['elementId'])
    for c in (left, right):
        for s in c['segments']:
            add(s['value'], s['element'], c['chainId'] + '#' + str(s['order']))
    add(turret['value'], 'tourelle-droite-base', turret['elementId'])
    return {
        'schema': 1,
        'ref': 'PA00086319',
        'kind': 'facade-rhythm-1d',
        'status': 'partial-non-certified',
        'source': 'bhdv-cc64-pl34',
        'derivedFrom': str(REG.relative_to(ROOT)),
        'generatedBy': 'scripts/derive_cc64_rhythm.py',
        'axis': 'le long de la façade sur la place, de gauche à droite sur la feuille',
        'origin': 'bord gauche de la base de la tourelle gauche (14e assise)',
        'unit': 'm (cotes du dessin de 1878)',
        'georeferenced': False,
        'verticalPosition': None,
        'courseHeight': 0.42,
        'depths': None,
        'usedByEngine': False,
        'limits': [
            'Les deux bases de tourelle (3,66) sont supposées sur la même ligne que les chaînes ; à confirmer.',
            'Aucune profondeur de saillie ni de niche, aucune hauteur : pas un volume.',
            'Non comparé à l\'état actuel ; non calé en EPSG:2154.'],
        'intervals': intervals,
        'length': x,
    }


if __name__ == '__main__':
    doc = build()
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(doc, ensure_ascii=False, indent=1) + '\n',
                   encoding='utf-8')
    print(len(doc['intervals']), 'intervalles, longueur', doc['length'], 'm')
