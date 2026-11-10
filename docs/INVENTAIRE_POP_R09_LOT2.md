# R09 lot 2 — Inventaire POP vérifié et fiches Histoire

État : **branche de développement uniquement** (PR #14). Version publique inchangée : 0.26.4.

## Chaîne reproductible

1. `python scripts/fetch_pop_notices.py --discover --workers 6`
   - découverte : identifiants Mérimée (P380) que Wikidata situe à Paris — **identifiants seulement**, aucune donnée descriptive reprise ;
   - vérification : chaque référence (index du jeu ∪ découverte) est lue sur l'API officielle POP v2 (Etalab 2.0) ; retenue seulement si POP la situe à Paris ;
   - cache brut hors dépôt (`data/cache/pop/`, ignoré) ; sortie `data/heritage/pop-notices-paris.json` (non publiée sur le site).
2. `python scripts/build_history_fiches.py` → `public/data/metropole/places/fiches/` (index + un fichier par arrondissement).
3. Contrôles : `tests/test_history_fiches_r09.py` (régénération identique, récit = champ HIST officiel, chaque repère issu d'un champ POP, statut cohérent avec les manques, 140 majeurs, Paris seulement, taille mobile).

Identifiant permanent : la référence POP/Mérimée (PA…, IA…, ACR…, EA…, MDI…, PJR…, JAR…). Dédoublonnage par référence.

## Volumes

| Étape | Nombre |
|---|---|
| Références de l'index du jeu | 1889 |
| Références découvertes (Wikidata) | 2067 |
| Union dédoublonnée | 2075 |
| Notices vérifiées à Paris | 2057 |
| Absentes de POP | 2 |
| Rejetées hors Paris | 16 |
| Fiches produites | 2057 |
| Notices hors de l'index d'origine du jeu | 169 |

Non retenues : ACR0001673, EA75000007, IA00060651, IA00060652, IA00060653, IA00060654, IA00060655, IA00060656, IA00060657, IA00060658, IA00060659, IA00074128, IA00075816, IA92000236, IA94000310, IA94000444, PA00104875, PA00133023.

## Par base

| Base | Fiches |
|---|---|
| Monument historique (immeuble protégé) | 1893 |
| Label Architecture contemporaine remarquable | 63 |
| Inventaire général du patrimoine culturel | 53 |
| Patrimoine du XXe siècle (repérage) | 18 |
| Label Maisons des Illustres | 13 |
| Parcs et jardins (pré-inventaire) | 9 |
| Label Jardin remarquable | 8 |

## Statuts de complétude

| Statut | Toutes | Majeurs (140) |
|---|---|---|
| documentee | 521 | 57 |
| recit-officiel-partiel | 205 | 10 |
| reperes-dates | 1070 | 62 |
| minimale | 261 | 11 |

## Par arrondissement

| Arr. | Total | documentee | recit-officiel-partiel | reperes-dates | minimale |
|---|---|---|---|---|---|
| 1 | 252 | 37 | 29 | 138 | 48 |
| 2 | 115 | 33 | 19 | 61 | 2 |
| 3 | 145 | 12 | 9 | 106 | 18 |
| 4 | 257 | 25 | 15 | 160 | 57 |
| 5 | 111 | 22 | 8 | 54 | 27 |
| 6 | 197 | 25 | 16 | 121 | 35 |
| 7 | 152 | 33 | 10 | 98 | 11 |
| 8 | 118 | 54 | 2 | 53 | 9 |
| 9 | 132 | 23 | 9 | 82 | 18 |
| 10 | 56 | 23 | 3 | 30 | 0 |
| 11 | 78 | 24 | 26 | 25 | 3 |
| 12 | 66 | 20 | 22 | 17 | 7 |
| 13 | 41 | 21 | 4 | 13 | 3 |
| 14 | 71 | 39 | 2 | 29 | 1 |
| 15 | 44 | 20 | 6 | 18 | 0 |
| 16 | 81 | 51 | 4 | 19 | 7 |
| 17 | 30 | 13 | 1 | 14 | 2 |
| 18 | 35 | 23 | 4 | 7 | 1 |
| 19 | 35 | 15 | 1 | 14 | 5 |
| 20 | 22 | 8 | 2 | 10 | 2 |
| non-localise | 19 | 0 | 13 | 1 | 5 |

`non-localise` : notices parisiennes dont POP ne donne ni arrondissement ni point situé dans un arrondissement (ensembles multi-arrondissements, enceintes, réseaux).

## Limites (aucune exhaustivité absolue revendiquée)

- Couverture limitée aux bases POP/Mérimée ; statues, fontaines non protégées, sites disparus et patrimoine non protégé ne sont pas encore inventoriés.
- Sources injoignables depuis l'environnement : API data.culture, opendata.paris.fr, Overpass.
- Pour 1331 fiches (`reperes-dates` + `minimale`), la notice officielle ne contient pas de récit : aucun récit n'est inventé ; la fiche le déclare.
- Les points POP ne certifient pas les emprises IGN ; seules les emprises majeures de `heritage-footprints.json` reçoivent le beige.

