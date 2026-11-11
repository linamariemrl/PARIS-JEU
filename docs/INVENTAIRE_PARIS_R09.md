# PARIS — Lot R09 : premier audit du corpus POP

**Statut : branche PR #14, non publiée.** Le résultat concerne des points de notices, non des modèles 3D certifiés.

- Corpus POP/Mérimée géolocalisé existant : **2284** références.
- À l'intérieur des vingt arrondissements : **1889** références.
- Hors des vingt polygones d'arrondissements : **395** références.
- Les **140 monuments majeurs POP** du catalogue antérieur sont inclus dans Paris. Les **55 candidats sans identifiant POP** restent distincts.
- Source extraite le 2026-11-08T01:13:06.637335+00:00. Frontières géographiques : `public/data/metropole/limits.geojson`.
- Reproduction : `python scripts/prepare_paris_monument_index.py`.

| Arrondissement | Notices POP géolocalisées |
|---:|---:|
| 1e | 246 |
| 2e | 117 |
| 3e | 145 |
| 4e | 255 |
| 5e | 109 |
| 6e | 196 |
| 7e | 142 |
| 8e | 118 |
| 9e | 133 |
| 10e | 57 |
| 11e | 47 |
| 12e | 33 |
| 13e | 25 |
| 14e | 65 |
| 15e | 27 |
| 16e | 79 |
| 17e | 22 |
| 18e | 31 |
| 19e | 27 |
| 20e | 15 |

## Limites

Aucun de ces nombres ne mesure la totalité du patrimoine parisien.
Les points ne prouvent ni l'emprise exacte, ni la protection de chaque aile.
Le fichier source géolocalise aussi des communes limitrophes, ce qui
justifie son découpage géographique explicite. L'inventaire doit encore
croiser l'Inventaire général, la Ville, les œuvres publiques, les monuments
déplacés ou disparus, les listes OSM et les fiches historiques. Les
textes non sourcés ne doivent jamais être inventés.
