# Transmission — construction de l'outil d'enrichissement graphique

> **DIRECTIVE R11 (11 novembre 2026) — prioritaire :** consulter
> [la décision architecture multi-vues et monochromie](DECISION_ARCHITECTURE_MULTIVUES_R11.md).
> La précision des monuments doit venir de la **géométrie photogrammétrique
> multi-vues, des plans et mesures**. Leur **matériau reste uniformément beige
> `#DED0B9` dans tous les modes**, y compris après enrichissement. Les clauses
> antérieures prescrivant des couleurs/textures réalistes pour les monuments
> sont **remplacées** par R11. L'IGN sert à l'ancrage, aux toits et au contrôle,
> et non de plafond au détail des façades. Les constructions ordinaires
> restent neutres en mode Maquette.

De : Claude (PR #14, branche `claude/practical-archimedes-n57pkx`)
À : ChatGPT, chargé de construire l'outil
Date : 11 novembre 2026
État : rien n'est publié ; version publique 0.26.4 ; aucune fusion sans accord exprès du propriétaire.

---

## 1. Ce qui est livré et prêt (vérifié, CI 4/4 verte sur `556105f`)

| Élément | Fichier | État |
|---|---|---|
| Export des unités | `scripts/export_units.py` | 289 771 bâtiments `bat:<id IGN>` + 5 674 dalles de sol `sol:ix_iz` (200 m) |
| Contrat d'échange | `docs/UNITES_EXPORT.md`, `schemas/unite-v1.schema.json` | stable, version `paris-unite/1` |
| **Cahier des charges de l'outil** | **`docs/CONSIGNE_OUTIL_ENRICHISSEMENT.md`** | à appliquer tel quel |
| Contrôle de réception | `scripts/check_unit_return.py` | refuse : version périmée, ancre modifiée, glTF invalide, hors emprise, source interdite, budget dépassé, LOD manquant, rapport absent, élément inventé |
| Tests | `tests/test_units_export.py` | 10 tests (Lambert-93 au mm près contre pyproj, faces orientées, glTF valide, retours acceptés et refusés) |
| Preuve visuelle | `docs/preuves/unites-zone-notre-dame.png` | 88 unités rechargées ensemble, raccord exact |

Commandes :

```bash
python scripts/export_units.py --catalogue
```

```bash
python scripts/export_units.py --zone 2.3499,48.8530,150
```

```bash
python scripts/check_unit_return.py retours/bat/BATIMENT0000000305564422
```

```bash
python -m unittest tests.test_units_export -v
```

---

## 2. Existe-t-il déjà un outil gratuit ? Réponse : non, pas en un seul morceau

Recherche faite le 11 novembre 2026. Aucun outil libre ne fait à la fois LiDAR → toits, façades réalistes, textures, LOD, et nos contrôles.
Mais les briques existent : **l'outil est un assemblage, pas une invention**.

| Besoin | Brique libre | Remarques |
|---|---|---|
| Toits LoD2 depuis nuage LiDAR + emprise | **roofer** (TU Delft / 3DBAG), `github.com/3DBAG/roofer` | Exactement notre cas : nuage de points + polygone d'emprise → LoD1.2, LoD1.3, LoD2.2. CLI et bindings Python. GPLv3 ; en développement actif (API instable). Produit du CityJSONSequence. Conçu pour la chaîne 3DBAG (Pays-Bas, BAG + AHN), donc à valider sur LiDAR HD IGN (~10 pts/m²) |
| Variante | City4CFD (TU Delft) | reconstruction LoD2.2 / LoD1.3 / LoD1.2 depuis nuage + polygones |
| Lecture LiDAR HD (COPC), filtrage par classe, MNT | PDAL | classes ASPRS : 2 sol, 6 bâtiment, 3 à 5 végétation, 9 eau |
| Rasters (BD ORTHO, MNT/MNS 50 cm), reprojection | GDAL / rasterio | rasterio, numpy, shapely et pyproj sont déjà installés par la CI `release-validation` |
| Conversion CityJSON → glTF | cjio (CityJSON) puis notre écrivain glTF (`export_units.glb()`), ou trimesh | garder le repère local de l'unité (§3) |
| Textures, façades, LOD, rendu d'aperçu | Blender en mode script (`blender -b -P`), décimation, cuisson de textures | moteur hors ligne ; aucune dépendance au jeu |
| Matériaux PBR génériques | bibliothèques CC0 (ambientCG, Poly Haven) | rugosité et normales seulement ; la couleur vient des photos |
| Compression glTF | gltfpack (meshoptimizer), KTX2 (Basis Universal) | extensions `EXT_meshopt_compression`, `KHR_texture_basisu` |
| Validation glTF | gltf-validator (Khronos, npm) | nos 88 `base.glb` : 0 erreur, 0 avertissement |

Côté données : l'IGN ne publie pas (à notre connaissance au 11/11/2026) de bâtiments 3D LoD2 prêts à l'emploi ; il publie le **LiDAR HD classé** et les MNT/MNS/MNH, en Licence Ouverte (Etalab 2.0).
L'index WFS `IGNF_LIDAR-HD_METADONNEE:metadata` a été interrogé avec succès : il donne par dalle de 1 km `url_npl` (nuage COPC), `url_mnt`, `url_mns`, `url_mnh`.
Exemple vérifié : `LHD_FXX_0652_6862` couvre Notre-Dame.
**À vérifier en premier** : présence d'une maquette 3D municipale en open data Ville de Paris / APUR. Depuis l'environnement de Claude, `opendata.paris.fr` était injoignable ; cela n'a donc pas pu être vérifié.

**Le seul maillon vraiment à créer : les façades réalistes.** Aucune brique libre ne produit des façades parisiennes fidèles.
Voie recommandée : grammaire procédurale par époque (BDNB, APUR), calée sur le nombre d'étages mesuré et sur les photos Panoramax, et **déclarée procédurale** dans le rapport de qualité.

---

## 3. Pièges déjà rencontrés (ne pas les redécouvrir)

1. **Deux stockages de bâtiments.** Le 4e arrondissement (2 696 bâtiments) est dans `public/data/4e/tiles/*.json`, en **WGS84**, tuiles de 300 m. Le reste est dans `public/data/metropole/buildings/tiles/*.json`, dans le repère du jeu, tuiles de 800 m. `export_units.py` normalise les deux.
2. **Repère du jeu** : x = est, z = **nord**, origine lon 2,3537 / lat 48,8545, projection équirectangulaire locale (`MX = 111320·cos(lat)`, `MZ = 111132`).
   **Repère local glTF de l'unité** : X = est, Y = haut, Z = **sud**. Ne pas confondre les deux.
3. **Orientation des faces** : passer de z nord à Z sud est une symétrie qui inverse le sens des triangles. Dans le visualiseur Babylon (main gauche), inverser z suffit ; ne pas inverser aussi l'ordre des indices, sinon on ne voit que l'intérieur des murs.
4. **Lambert-93** : la formule de `export_units.l93` est identique à pyproj au millimètre. Ne pas introduire de seconde implémentation.
5. **Relief de base** : grille RGE ALTI de 200 m interpolée, à remplacer par le MNT LiDAR 50 cm. Un pied de mur calé sur la grille de 200 m peut être faux de plusieurs mètres : d'où la jupe de 1 m sous le sol exigée par la consigne.
6. **POP / Mérimée** : 109 points de notices sont faux (`[0,0]`, latitudes 43,8° au lieu de 48,8°, coordonnées inversées). Ils sont écartés à la source ; ne jamais placer un monument d'après un point POP sans contrôle.
7. **Monuments majeurs** : la liste fait foi dans `src/heritagePriorities.ts` (140 références). Le rattachement des bâtiments IGN se fait par `public/data/metropole/architecture/heritage-footprints.json`. Beige du jeu : `#DED0B9`.
8. **Mode maquette** : le propriétaire exige de conserver le rendu blanc/gris sans texture. Les unités enrichies doivent rester lisibles sans texture et fournir les matériaux `maquette-neutre` et `maquette-majeur`.
9. **Budget du site** : `scripts/check_site_size.py` limite le déploiement ; le site fait déjà 114,2 Mo.
   Les unités enrichies ne peuvent pas toutes être embarquées dans le site : il faudra un hébergement à part (par exemple les publications GitHub ou un stockage d'objets) et un chargement à la demande.

---

## 4. Plan de construction recommandé (par jalons vérifiables)

**J1 — Prototype sur une seule unité : Notre-Dame (`bat:BATIMENT0000000305564422`)**
- télécharger la dalle `LHD_FXX_0652_6862` (index WFS → `url_npl`) ;
- PDAL : points de classe 6 dans l'emprise + 1 m ; points de classe 2 dans la couronne de 3 m ;
- roofer → LoD2.2 → conversion dans le repère local de l'unité → `enrichi.glb` ;
- `rapport-qualite.json` : écart RMS au nuage, déclarations ;
- **critère** : `check_unit_return.py` accepte, aperçu PNG fourni, et l'écart RMS ≤ 0,30 m.

**J2 — Une dalle de sol (`sol:-2_-1`, île de la Cité)** : MNT 50 cm, coutures, ortho BD ORTHO recalée, eau, arbres.
**Critère** : bords identiques à ceux d'une dalle voisine traitée.

**J3 — Un îlot complet (dalle + ses 48 bâtiments)**, toits LoD2 + textures de toit + LOD0/1/2.
**Critère** : 100 % des unités acceptées, poids dans les budgets.

**J4 — Façades procédurales par époque** sur ce même îlot, déclarées procédurales.

**J5 — Production en série**, dans l'ordre de priorité de la consigne (§1), avec reprise sur erreur et cache des dalles LiDAR.

**J6 — Intégration dans le jeu** (lot séparé, à faire avec le propriétaire) :
- chargeur d'unités par distance et repli sur la base ;
- conservation du mode maquette ;
- aucune régression de performance sur Android.

---

## 5. Règles du propriétaire à respecter

- Continuer sur la PR #14 sans toucher `main` ; ne pas fusionner, ne pas publier, ne pas annoncer 0.27 sans autorisation expresse.
- Aucune donnée Google Earth / Street View ni d'autre source fermée.
- À chaque livraison :
  - ce qui a été ajouté et les nombres exacts ;
  - les tests passés et échoués ;
  - ce qui reste incomplet ;
  - le SHA du dernier commit et le lien de la PR ;
  - le lien du jeu https://meyameya677-sketch.github.io/Paris-le-jeu/ ;
  - si c'est publié ou seulement sur la branche.
