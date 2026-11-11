# PARIS — Audit des informations historiques (R09)

**Branche non publiée — inventaire initial, sans prétention d'exhaustivité.**

Sur les **1889 notices POP localisées dans les vingt arrondissements** :
- **858** ont au moins un champ de datation POP ;
- **37** ont une description textuelle dans le corpus local ;
- **23** disposent d'un récit spécifique associé par identifiant POP dans le code, sans compter les quelques récits retrouvés par le nom ;
- **1011** ne possèdent **aucun** de ces trois indices documentaires, selon cet audit. Ce n'est pas nécessairement une absence de toute histoire dans des sources externes.

Les champs de datation ne garantissent ni une chronologie complète ni une histoire vérifiée. Les descriptions peuvent être architecturales plutôt qu'historiques. Les notices disposent presque toutes de métadonnées factuelles (adresse, protection, auteurs selon les cas), désormais affichables en fiche sans leur inventer une biographie.

| Arrondissement | Notices | Datation | Description POP | Récit par identifiant | Sans ces trois indices |
|---:|---:|---:|---:|---:|---:|
| 1e | 246 | 59 | 2 | 4 | 184 |
| 2e | 117 | 63 | 4 | 1 | 51 |
| 3e | 145 | 31 | 2 | 0 | 112 |
| 4e | 255 | 42 | 4 | 4 | 208 |
| 5e | 109 | 39 | 2 | 2 | 68 |
| 6e | 196 | 53 | 3 | 1 | 141 |
| 7e | 142 | 85 | 2 | 4 | 55 |
| 8e | 118 | 89 | 6 | 6 | 28 |
| 9e | 133 | 57 | 3 | 1 | 76 |
| 10e | 57 | 45 | 1 | 0 | 12 |
| 11e | 47 | 35 | 1 | 0 | 12 |
| 12e | 33 | 25 | 1 | 0 | 8 |
| 13e | 25 | 19 | 0 | 0 | 6 |
| 14e | 65 | 55 | 1 | 0 | 10 |
| 15e | 27 | 26 | 1 | 0 | 1 |
| 16e | 79 | 64 | 0 | 0 | 15 |
| 17e | 22 | 20 | 1 | 0 | 2 |
| 18e | 31 | 26 | 2 | 0 | 5 |
| 19e | 27 | 18 | 0 | 0 | 9 |
| 20e | 15 | 7 | 1 | 0 | 8 |
| **Total** | **1889** | **858** | **37** | **23** | **1011** |

Reproduire : `python scripts/audit_paris_histories.py`.

## Suite éditoriale prioritaire

1. Contrôler les fiches des **140 monuments majeurs** d'abord ; compléter chacune avec chronologie, transformations, responsables, rôle historique, protection et liens de sources vérifiés.
2. Parcourir ensuite les **1011** notices sans indices dans le corpus local, par arrondissement et par importance documentaire, en croisant les sources officielles plutôt qu'en inventant des événements.
3. Distinguer les fiches d'ensembles, les monuments disparus, les objets isolés et les changements d'usage, avec provenance par affirmation.
4. Conserver le filtre des vingt arrondissements, les 55 candidats non appariés et la neutralité visuelle des notices non majeures.

**Pas de promesse « toutes les histoires sont remplies » : cet audit mesure précisément ce qui reste.**
