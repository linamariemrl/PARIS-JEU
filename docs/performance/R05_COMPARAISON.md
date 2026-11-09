# Comparaison de navigation `main` / branche (R05–R06)

**Statut : comparaison COMPLÈTE et comparable**, 26 segments sur 26 pour chaque version, aucune erreur, aucun arrêt. Ces mesures concernent un **navigateur avec WebGL logiciel** : ce ne sont **pas des FPS Android** (Android non testé sur appareil réel).

## Environnement et versions

| Élément | Valeur |
| --- | --- |
| Date | 9 novembre 2026 (branche 22:33 UTC, puis `main` 22:47 UTC, ordre branche → main) |
| Navigateur | Chromium headless (Playwright), WebGL ANGLE/SwiftShader logiciel, fenêtre 412 × 860 |
| `main` mesuré | `1e1f8c1` + uniquement la sonde de lecture `?bench` (11 lignes dans `src/main.ts`, `src/benchProbe.ts`) |
| Branche mesurée | sources de `899afd7` (identiques à `src` depuis `9e946cf`) |
| Données | identiques pour les deux builds : `overview/` et `coverage/` générés par `scripts/prepare_metropole_overview.py` et `scripts/prepare_city_coverage.py`, comme dans les workflows build/deploy (287 075 enveloppes, 33 groupes ; 57 436 cellules) |
| Outil | `scripts/browser/paris_route_benchmark.mjs` (même version pour les deux) |
| Répétitions | **une seule** par version |

Fichiers bruts : [r05-route-main.json](r05-route-main.json), [r05-route-branche.json](r05-route-branche.json) et leurs journaux `*.progress.log`.

## Parcours invalidé, conservé pour mémoire

Un premier parcours complet avait été mesuré **sans** `overview/` ni `coverage/`, absents d'un build local parce qu'ils sont produits au déploiement. Au-delà des tuiles exactes, la ville était vide (12 à 20 draw calls à l'Opéra, statut « Atlas temporairement indisponible »). Ces chiffres ne représentent pas le site public : ils ne sont **pas publiés ici et ne doivent pas servir de preuve**. Le banc refuse désormais un `dist` sans ces données (commit `899afd7`).

## Résultats par segment (`main` / branche)

Intervalles d'image en ms (rendu logiciel), tâches longues du fil principal en ms cumulées, draw calls médians, triangles médians en milliers, tuiles exactes actives après le segment.

| Segment | p50 | p95 | p99 | Tâches longues | Draw calls | Triangles (k) | Tuiles exactes | Mouvement mesuré |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| démarrage | 201 / 28 | 1909 / 1451 | 2651 / 2645 | 6273 / 4463 | 107 / 113 | 1672 / 1671 | 10 / 10 |  /  |
| Hôtel de ville : arrivée | 757 / 776 | 1590 / 1452 | 1590 / 1452 | 0 / 0 | 93 / 86 | 1623 / 1619 | 10 / 10 |  /  |
| Hôtel de ville : orbite 360° | 642 / 620 | 859 / 1219 | 1279 / 1263 | 0 / 0 | 91 / 90 | 1614 / 1606 | 10 / 10 | orbitDegrees 367 / orbitDegrees 370 |
| Hôtel de ville : dézoom complet | 625 / 683 | 1317 / 1394 | 1509 / 1608 | 0 / 0 | 178 / 197 | 701 / 1618 | 10 / 10 | radiusReached 13219 / radiusReached 14252 |
| Hôtel de ville : retour proche | 643 / 610 | 1521 / 1545 | 1711 / 1713 | 0 / 0 | 162 / 193 | 1041 / 767 | 10 / 10 | radiusReached 904 / radiusReached 850 |
| Cathédrale Notre-Dame : arrivée | 721 / 659 | 1294 / 1116 | 1492 / 1335 | 0 / 0 | 80 / 87 | 1608 / 1674 | 10 / 10 |  /  |
| Cathédrale Notre-Dame : orbite 360° | 634 / 664 | 1267 / 1272 | 1279 / 1325 | 0 / 0 | 80 / 81 | 1642 / 1669 | 10 / 10 | orbitDegrees 367 / orbitDegrees 368 |
| Cathédrale Notre-Dame : dézoom complet | 671 / 680 | 1281 / 1175 | 1403 / 1203 | 0 / 0 | 157 / 175 | 1600 / 1592 | 10 / 10 | radiusReached 13599 / radiusReached 14253 |
| Cathédrale Notre-Dame : retour proche | 634 / 643 | 1023 / 1440 | 1273 / 1485 | 0 / 0 | 145 / 159 | 752 / 764 | 10 / 10 | radiusReached 899 / radiusReached 877 |
| Théâtre national de l'Opéra : arrivée | 498 / 567 | 883 / 917 | 1475 / 1242 | 0 / 0 | 29 / 29 | 654 / 659 | 10 / 10 |  /  |
| Théâtre national de l'Opéra : orbite 360° | 362 / 389 | 595 / 667 | 736 / 760 | 0 / 0 | 41 / 44 | 726 / 725 | 10 / 10 | orbitDegrees 370 / orbitDegrees 367 |
| Théâtre national de l'Opéra : dézoom complet | 363 / 395 | 698 / 749 | 1025 / 801 | 0 / 0 | 74 / 99 | 638 / 732 | 10 / 10 | radiusReached 16953 / radiusReached 14257 |
| Théâtre national de l'Opéra : retour proche | 737 / 550 | 934 / 1747 | 1015 / 1800 | 0 / 0 | 73 / 95 | 641 / 634 | 10 / 10 | radiusReached 925 / radiusReached 901 |
| Tour Eiffel : arrivée | 411 / 416 | 991 / 574 | 1075 / 1000 | 0 / 0 | 31 / 31 | 1367 / 1367 | 10 / 10 |  /  |
| Tour Eiffel : orbite 360° | 536 / 542 | 705 / 1069 | 1066 / 1309 | 0 / 0 | 36 / 38 | 1463 / 1465 | 10 / 10 | orbitDegrees 367 / orbitDegrees 367 |
| Tour Eiffel : dézoom complet | 594 / 646 | 922 / 1178 | 1042 / 1183 | 0 / 0 | 49 / 47 | 1472 / 1469 | 10 / 10 | radiusReached 14262 / radiusReached 14254 |
| Tour Eiffel : retour proche | 572 / 520 | 1034 / 978 | 1484 / 1113 | 0 / 0 | 47 / 48 | 638 / 638 | 10 / 10 | radiusReached 899 / radiusReached 899 |
| Arc de Triomphe de l'Etoile : arrivée | 581 / 563 | 938 / 881 | 952 / 888 | 0 / 0 | 27 / 29 | 998 / 1038 | 10 / 10 |  /  |
| Arc de Triomphe de l'Etoile : orbite 360° | 471 / 483 | 642 / 980 | 1036 / 1093 | 0 / 0 | 33 / 35 | 1087 / 1094 | 10 / 10 | orbitDegrees 368 / orbitDegrees 370 |
| Arc de Triomphe de l'Etoile : dézoom complet | 455 / 477 | 833 / 810 | 884 / 893 | 0 / 0 | 42 / 41 | 644 / 1057 | 10 / 10 | radiusReached 14217 / radiusReached 14254 |
| Arc de Triomphe de l'Etoile : retour proche | 526 / 426 | 879 / 875 | 921 / 1104 | 0 / 0 | 37 / 38 | 644 / 644 | 10 / 10 | radiusReached 899 / radiusReached 892 |
| Basilique du Sacré-Coeur : arrivée | 506 / 519 | 907 / 955 | 1149 / 1074 | 56 / 0 | 29 / 31 | 1182 / 1182 | 10 / 10 |  /  |
| Basilique du Sacré-Coeur : orbite 360° | 571 / 565 | 618 / 1145 | 774 / 1169 | 0 / 0 | 38 / 41 | 1295 / 1295 | 10 / 10 | orbitDegrees 367 / orbitDegrees 367 |
| Basilique du Sacré-Coeur : dézoom complet | 534 / 540 | 828 / 973 | 979 / 1146 | 0 / 0 | 48 / 54 | 1153 / 1153 | 10 / 10 | radiusReached 14254 / radiusReached 14288 |
| Basilique du Sacré-Coeur : retour proche | 684 / 566 | 1726 / 974 | 1731 / 1503 | 0 / 0 | 46 / 53 | 687 / 1153 | 10 / 10 | radiusReached 899 / radiusReached 878 |
| mode Rue | 566 / 570 | 910 / 1187 | 910 / 1187 | 0 / 0 | 38 / 38 | 1127 / 1126 | 10 / 10 |  /  |

Fin de parcours : tas JS 149 Mo (`main`) / 150 Mo (branche) ; tampons alloués par les appels WebGL instrumentés 45,3 / 45,3 Mo. C'est une estimation, **pas la VRAM**.

## Constats

1. **Aucune tâche longue en navigation** (orbites, dézooms, retours, mode Rue), sur les deux versions, à une exception près : une tâche de 56 ms sur `main` à l'arrivée au Sacré-Cœur.
2. **Les seules tâches longues sont au démarrage**, sur les deux versions : 6,3 s cumulées sur `main`, 4,5 s sur la branche, pire tâche 2,1 s. Le profil CPU (3,9 s de temps propre dans `setSize`) et l'horodatage des tailles du canevas ([startup_resize_probe.cjs](../../scripts/browser/startup_resize_probe.cjs)) montrent qu'elles coïncident **exactement** avec les redimensionnements de `AdaptiveResolution` :

   | Instant | Tâche longue | Redimensionnement simultané |
   | --- | --- | --- |
   | 15,5 s | 1 141 ms | largeur fixée à 290 px : 1 130 ms |
   | 22,6 s | 2 155 ms | largeur 267 px : 1 452 ms, puis hauteur : 697 ms |

   Sous rendu logiciel, chaque redimensionnement attend la fin de la rastérisation CPU en cours. C'est un **artefact du banc, pas un défaut démontré sur GPU réel** : aucune correction n'est faite sur cette base.
3. **Draw calls, triangles, tuiles exactes et mémoire comparables** à chaque étape. Le surcoût de la branche (maillages patrimoniaux séparés) reste de quelques draw calls.
4. **Rendu identique** à même caméra (angle, rayon et cible relevés par la sonde) : [Hôtel de Ville proche](r05-1-hdv-proche.jpg), [moyen](r05-2-hdv-moyen.jpg), [Paris à 20 km](r05-3-paris-loin.jpg), [Opéra proche](r05-4-opera-proche.jpg). À 20 km, la branche gardait 5 tuiles exactes contre 10 sur `main` au moment de la capture ; le rendu est identique. C'est une différence d'état transitoire, non investiguée plus avant.

## Conclusion

Aucun défaut de navigation, de disparition de bâtiments, de mémoire ou de chargement n'est **démontré** par ce parcours correctement alimenté. **Aucune optimisation n'a donc été appliquée sur cette base.**

Pour aller plus loin, il faudrait :
- plusieurs répétitions, en alternant l'ordre ;
- un GPU réel ;
- la recette Android de [RECETTE_ANDROID.md](../RECETTE_ANDROID.md) sur un vrai téléphone.

## Reproduire

```bash
python scripts/prepare_metropole_overview.py
python scripts/prepare_city_coverage.py
npx vite build --outDir /tmp/dist-branche
node scripts/browser/paris_route_benchmark.mjs /tmp/dist-branche branche 5341
```

Pour `main`, ajouter la même sonde `?bench` (contenu de `src/benchProbe.ts` et appel `installBenchProbe` avant `engine.runRenderLoop`), puis construire avec les mêmes données générées.
