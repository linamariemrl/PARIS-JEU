# NAVETTE TECHNIQUE — PARIS-LE-JEU — R01
## Passation exhaustive vers Claude AI · reconstruction géométrique fidèle des monuments parisiens

**État observé : 9 novembre 2026, après intégration du correctif 0.26.4.**  
**Provenance de cet état : lecture directe des fichiers, métadonnées et GitHub Actions du dépôt `meyameya677-sketch/Paris-le-jeu`.**  
**Révision source immuable examinée : `f1c018df788e6d0fc8ee6248d5f35e1e4cb11ed5` (branche `main`).**  
**Version applicative : `0.26.4`, affichage d'en-tête `PROTOTYPE 0.26`.**  
**Responsables de la suite : utilisateur + Claude AI ; ChatGPT reprend ensuite la navette R02/R03.**  
**Statut de la 0.27 : NON atteinte et NON autorisée comme « maquette fidèle » dans l'état actuel.**

> **Instruction impérative à Claude :** Ce document n'est pas une demande de présentation conceptuelle. Il s'agit d'un chantier de logiciel réel. Examine **d'abord le dépôt au commit indiqué**, les types TypeScript, les données et les tests ; réalise ensuite des modifications effectives et livrables si tu disposes des outils nécessaires. Si tu n'as pas accès au dépôt, renvoie des fichiers complets ou un patch `git diff`, ses conditions d'application et des tests exécutables, sans prétendre avoir modifié GitHub. Conserve une copie enrichie de cette navette au format R02 pour retour vers ChatGPT. **Ne prétends jamais qu'un modèle est exact sans plans cotés interprétés, mesure géoréférencée et audit indépendant.**

---

# 1. Mission et formulation non négociable du propriétaire du projet

Le projet **PARIS** est un véritable jeu/simulateur municipal 3D, exécutable sur navigateur/PWA et Android (APK de développement). Le joueur dirige la municipalité de Paris. La maquette englobe Paris, les bois et les communes limitrophes. Le jeu conserve navigation 360°, horloge, 80 quartiers administratifs, sélection des édifices, informations patrimoniales, dossier de gestion municipale, sauvegarde et export/import. Il n'est pas question de remplacer le jeu par une visualisation statique, des captures générées par IA ou un exemple Babylon.js isolé.

**Refus exprimé à plusieurs reprises par l'utilisateur :** les monuments « schématiques » ou « qui ressemblent vaguement » ne conviennent pas. L'Hôtel de Ville, Notre-Dame, la tour Eiffel, le Louvre, les palais, institutions, grands musées, gares, bâtiments historiques et monuments majeurs doivent être reconstruits **trait pour trait en respectant les véritables dimensions attestées**, les élévations, coupes, façades, ouvertures, sculptures, corniches, toitures, travées, ailes, cours, tours, escaliers, charpentes et transformations historiques. La matière première doit venir **prioritairement des plans architecturaux cotés publics et dossiers d'exécution**, plus LiDAR et volumes bâtis ; non de photographies seules ni d'emprises cadastrales seules. Les documents insuffisants imposent un statut **non certifié**, et non l'invention de détails.

**Direction graphique validée provisoirement :** maquette urbaine globalement blanc/gris, sans imagerie satellite ni textures aériennes apparentes, sans animation visuelle du cycle jour/nuit. Garder l'horloge de simulation. Seuls certains bâtiments sont discrètement codés par fonction : institution politique/administrative **orange clair**, monument touristique **beige pierre**, culturel **violet clair**, économique/financier/commercial **bleu clair**. Les véritables proportions comptent davantage que les effets de matière. La teinte ne constitue pas une preuve du statut ou de l'identité d'une emprise.

**Mobile :** déplacements très fluides, tournants et orbitations 360°, gestes tactiles robustes, chargement progressif et LOD dérivés d'un **modèle de référence de haute précision**, sans rétrograder la précision du master. Objectif du cahier des charges initial : au moins 30 FPS sur appareils mobiles récents **après vérification sur appareil réel** ; ce seuil n'a pas encore été mesuré/validé. Ne pas créer de coûteux meshes/allocations à chaque frame ou au cours d'une manipulation.

**Contraintes d'usage :** les choix de jeu, l'interface actuelle, les 80 quartiers, le mode mairie, les contrôles, le système de sauvegardes et la compatibilité Web/Android doivent survivre. Ne pas confondre communes limitrophes et périmètre de compétence du maire de Paris. Préserver l'attribution des sources, les licences et la distinction entre observation, reconstruction, estimation et simulation.

---

# 2. Où se trouve le vrai projet et quelle livraison est vérifiée ?

- **Dépôt public :** https://github.com/meyameya677-sketch/Paris-le-jeu
- **Commit de référence :** https://github.com/meyameya677-sketch/Paris-le-jeu/commit/f1c018df788e6d0fc8ee6248d5f35e1e4cb11ed5
- **Code figé du commit de référence :** https://github.com/meyameya677-sketch/Paris-le-jeu/tree/f1c018df788e6d0fc8ee6248d5f35e1e4cb11ed5
- **Jeu Web publié (GitHub Pages) :** https://meyameya677-sketch.github.io/Paris-le-jeu/
- **Dernière publication Web réussie (build n°374, SHA identique) :** https://github.com/meyameya677-sketch/Paris-le-jeu/actions/runs/42638528424
- **Vérification générale réussie (même SHA) :** https://github.com/meyameya677-sketch/Paris-le-jeu/actions/runs/42638528371
- **Compilation APK de test réussie (même SHA, exécution n°68) :** https://github.com/meyameya677-sketch/Paris-le-jeu/actions/runs/42638528328
- **Artefact GitHub Actions :** `PARIS-Android-0_26_4-debug-68` ; artifact ID `13683454554` ; **40 308 912 octets** en ZIP ; fichier embarqué attendu `app-debug.apk`. La connexion GitHub peut être requise pour télécharger les artefacts ; l'APK est un **debug build**, pas une application de magasin et pas une certification Android de performance.
- **Révision applicative :** `package.json: version=0.26.4`, `src/release.ts: REVISION='0.26.4'`, `PROTOTYPE='0.26'`.
- **Ne pas appeler cette livraison « 0.27 » :** aucune maquette monumentale complète certifiée n'est chargée dans le moteur.

Le moteur TypeScript et la suite d'intégration ont passé les contrôles automatisés du 9 novembre 2026. Cela ne remplace **pas** une vérification de l'écran du téléphone, des FPS, de l'orientation correcte, du rendu des arches, des détails et de la fluidité tactile : ces essais restent à conduire. En cas de changement postérieur du dépôt, **relever le nouveau SHA et refaire les vérifications avant d'appliquer le patch**. Ne jamais supposer que `main` est restée figée.

**Important :** un APK construit avant la modification d'un JSON LiDAR n'intègre pas magiquement cette modification. Le dernier build n°68 a été déclenché après l'intégration des données et a réussi. La PWA a son propre service worker : sur un ancien téléphone, un cache ou une ancienne installation peut encore afficher une précédente révision. Pour vérifier, ouvrir le panneau des détails et consulter `Version 0.26.4` ; sur PWA, demander « Installer la mise à jour » si la notification est proposée ou recharger la page. Sur APK, installer le nouveau binaire. Ne jamais confondre simple `git push`, publication Pages et install réellement mise à jour.

---

# 3. Tableau de vérité : obtenu, partiellement obtenu, non obtenu

| Éléments | État constaté | Preuve / précaution |
|---|---|---|
| Projet Web Babylon.js/Vite/TS accessible et compilé | **OUI** | Workflow Pages n°42638528424, succès ; code au SHA ci-dessus |
| APK Android debug 0.26.4 | **OUI : compilé** | Workflow n°42638528328 ; ZIP d'artefact n°13683454554 |
| Essai réel sur téléphone / objectif 30 FPS | **NON VALIDÉ** | CI compile, ne simule pas suffisamment la navigation mobile en conditions réelles |
| Maquette globale blanc-gris et codage discret des fonctions | **PRÉSENT DANS LE CODE** | `src/buildings.ts`, `src/heritageCategories.ts`, `src/landmarkBrowser.ts` |
| Navigation 360°, rue, orbite, zoom, restauration de caméra | **IMPLÉMENTÉ** | `src/mobileCamera.ts`, `src/cameraGestures.ts`, `src/main.ts` ; recette physique ouverte |
| Tous les 80 quartiers administratifs comme objets interactifs | **IMPLÉMENTÉ / TESTÉ EN CI** | `src/urbanAtlas.ts`, `src/quarterSelection.ts`, `scripts/prepare_urban_history.py` |
| Moteur municipal + projets, votes, finances et sauvegardes | **IMPLÉMENTATION PARTIELLE** | Modules `src/simulation/`; économie/vie réelle non exhaustive |
| Atlas géographique de bâtiments Paris + 29 communes limitrophes | **OUI : données indexées** | 287 075 bâtiments dans l'index BD TOPO, pas tous simultanément sous forme 3D précise |
| Bâtiments détaillés du 4e | **OUI : emprises IGN, hauteurs, quelques toits** | 2 696 empreintes, 27 tuiles, 2 520 hauteurs source / 176 estimées |
| Toitures LiDAR HD du 4e | **PARTIEL : 1 748 validées** | 948 autres non validées, `data/quality/lidar-4e-reconstruction.json` |
| Toiture de l'Hôtel de Ville mesurée | **OUI, surface partielle approuvée** | 3 490 triangles et 2 047 points ; couverture 98,26 %, sous contraintes MNH |
| Façade de l'Hôtel de Ville trait pour trait | **NON** | 7 sources documentaires indexées, presque aucune cote de détail transcrite |
| Sculptures/colonnes/travées/décors vérifiés | **NON** | Aucune pièce architecturale détaillée validée dans le modèle |
| Maquette détaillée de Notre-Dame / Tour Eiffel / autres | **NON** | Fiches de mesures globales / points d'archives seulement |
| Recensement prioritaire des monuments | **OUI, NON EXHAUSTIF** | 195 dossiers (140 références POP liées, 55 candidats sans appariement assuré) |
| Géométrie détaillée certifiée, index `models/index.json` | **0 MODÈLE** | `models: []` ; il s'agit d'une garantie anti-invention |
| Système de lecture LOD de modèles expertisés | **SQUELETTE CODE ÉCRIT** | `src/architectureModels.ts` ; aucune maquette complète pour test de bout en bout |
| Passage réel à 0.27 | **NON** | Non justifié sans premier monument géométriquement documenté et certifié |

La ligne « 1 748 toitures » compte **des surfaces dérivées et filtrées du LiDAR**, pas 1 748 maisons dont les façades, lucarnes ou fenêtres seraient authentifiées.

---

# 4. Vue d'ensemble du dépôt : couches et chemin de rendu

**Stack observée :** Vite 7 ; TypeScript ~5.8 ; Babylon.js `@babylonjs/core` ^8 ; Earcut ^3 ; VitePWA ^1 ; Capacitor 7 installé dans le workflow Android ; Node 22 GitHub Actions ; Python 3.12 pour les géométries, rasterio/numpy/shapely/pyproj lors des traitements géospatiaux. Dépendances exactes dans `package.json` et YAML, à vérifier au SHA de référence. Déploiement par GitHub Pages ; Android via GitHub Actions puis `npx cap add android`, `npx cap sync android`, `./gradlew assembleDebug`.

**Lancement de scène :** `src/main.ts` (~660 lignes) monte `Engine`, `Scene`, éclairage fixe, `GameClock`, terrain, `MobileCamera`, résolution dynamique, gestionnaire de tuiles du 4e, gestionnaire des bâtiments métropolitains, panoramas, eau/voies/arbres, atlas patrimonial, sélection quartiers, catalogue monuments, simulateur municipal et sauvegardes. La constante `STABLE_RENDER=true` maintient le rendu retenu, sans orthophoto affichée. Ne pas activer `src/aerial.ts` au nom d'une « amélioration » : les photographies aériennes existent historiquement dans le dépôt, mais ont été explicitement exclues du rendu demandé et des distributions finales.

**Modèles majeurs (repères de lecture) :**

```text
index.html                            interface approuvée, commandes, panneaux
src/style.css                         style et adaptation mobile
src/main.ts                           composition système, rendu, interaction et chargements asynchrones
src/types.ts                          Building, LidarRoofPart, tuiles, CityVolumeGroup
src/geo.ts                            projection locale approximative longitude/latitude -> x/z
src/buildings.ts                      triangulation, murs/toits, matériaux, batch de meshes
src/roofGeometry.ts                   profils procéduraux de toiture (souvent ESTIMÉS)
src/volumeGeometry.ts                 subdivision approximative selon niveaux municipaux
src/reliefAnchors.ts / terrain.ts      assises verticales, relief de terrain
src/tileManager.ts                    4e : 27 tuiles + overlays matériau/toiture/volume/MNH
src/metroTiles.ts                     287075 empreintes IGN, tuiles de proximité chargées à la demande
src/metroOverview.ts                  panorama de bâtiments agrégés/LOD
src/cityCoverage.ts                   couche de couverture 50m, agrégée et non exacte
src/metroRoads.ts / stableWater.ts     voies et eau géographiques
src/surfaceLayer.ts / heritageGardens.ts / trees.ts  sols, jardins et arbres
src/mobileCamera.ts / cameraGestures.ts / adaptiveResolution.ts  mobile/360/FPS
src/heritageAtlas.ts                  index POP, attribution à l'emprise et fiches
src/heritageCategories.ts             rôle et priorité de teinte des monuments
src/heritagePriorities.ts             140 références prioritaires assignées
src/landmarkBrowser.ts                bouton P, recherche, navigation, sources
src/architectureDossiers.ts           preuves documentaires, mesures et incertitudes dans les fiches
src/architectureModels.ts             lecteur/validation/LOD et masque de bâtiments remplacés
src/urbanAtlas.ts / quarterSelection.ts   80 quartiers
src/simulation/cityEngine.ts          simulation municipale et circulation abstraite
src/simulation/ui.ts / saveStore.ts    UI de gestion, IndexedDB, export/import JSON
src/release.ts                        0.26.4 affiché dans les détails du jeu
vite.config.ts                        base URLs Pages/Capacitor, manifeste PWA et caches
```

**ATTENTION** : dans `src/buildings.ts` les extrusions du bâti utilisent des façades **plates**, construites depuis les anneaux de l'emprise IGN. Cela ne recrée ni les détails de baies ni les motifs réels. `src/roofGeometry.ts` peut reconstruire une forme depuis des tags OSM, mais si la hauteur du toit n'est pas fournie, la pente est **explicitement estimée** (calcul proportionnel à la hauteur, clamp). `src/volumeGeometry.ts` élabore une hauteur d'étage avec `steppedHeight` : **approximation**, et un volume municipal n'apporte pas automatiquement une cote de toiture. Pour les monuments prioritaires, Claude devra mettre au premier plan la **hiérarchie de véracité** et empêcher de telles extrusions d'être présentées comme exactes.

La scène utilise des lots de murs et de toitures avec matériaux communs et un tableau `faceToBuilding` pour remonter à l'objet sélectionné. Toute insertion d'un modèle nouveau doit respecter cette association et les règles de sélection : un modèle non sélectionnable peut faire disparaître une partie de l'expérience actuelle.

---

# 5. Référentiel spatial et pièges métrologiques

**Origine actuelle du moteur dans `src/geo.ts` :**

```ts
export const CENTER: [number,number] = [2.3537, 48.8545]; // longitude, latitude
const METERS_X = 111320 * Math.cos(CENTER[1] * Math.PI / 180);
const METERS_Z = 111132;
x = (longitude - CENTER[0]) * METERS_X;
z = (latitude  - CENTER[1]) * METERS_Z;
```

Coordonnées de jeu : `x, y, z`, y vertical. `src/buildings.ts` pose la toiture à `stableFoundation(empreinte, terrainHeight) + hauteurMNH` quand les données sont valides. Sur la métropole, `public/data/metropole/terrain/manifest.json` indique un terrain interpolé depuis RGE ALTI **tous les 200 m**, et non une vérité centimétrique sous chaque porche. Le pas de terrain doit être distingué du pixel **LiDAR MNH 0,5 m** et du maillage de reconstruction d'Hôtel de Ville **2,5 m**.

Pour la **métrologie** et l'archivage du master, préférer un repère officiel **EPSG:2154 / Lambert-93**, avec altitude d'origine, convention de référence verticale, unités et transformations reproductibles. Puis transformer dans le repère local Babylon en documentant les résidus et contrôles. Ne pas prétendre qu'un degré de longitude et un degré de latitude valent partout exactement une constante. Les enveloppes rapportées ci-dessous ont été calculées avec la **projection locale simplifiée du moteur** ; elles ne constituent **pas** des cotes d'un plan d'exécution.

**Associations déjà vérifiées au 4e (notices POP géolocalisées situées dans des empreintes IGN) :**

| Réf. Mérimée | Nom | ID IGN | Tuile 4e | Aire 2D calculée | BBox 2D calculée | Attribut hauteur IGN |
|---|---|---|---|---:|---:|---:|
| PA00086319 | Hôtel de Ville | BATIMENT0000000245157267 | `-1_0` | 10 251,55 m² | 125,82 x 163,09 m | 25,2 m |
| PA00086250 | Cathédrale Notre-Dame | BATIMENT0000000305564422 | `-1_-1` | 2 148,13 m² | 106,96 x 63,00 m | 34,9 m |
| PA00086257 | Église Saint-Gervais-Saint-Protais | BATIMENT0000000253243449 | `0_0` | 2 776,07 m² | 81,60 x 60,79 m | 17,8 m |

Ces données sont stockées dans `public/data/metropole/architecture/survey-4e.json` et recalculées par `scripts/prepare_architecture_survey_4e.py`. **Important :** un identifiant de bâtiment IGN peut représenter seulement un élément d'un ensemble protégé. Par exemple la fiche « Notre-Dame » issue d'un point POP dans une empreinte IGN ne doit pas être confondue avec une mesure de toute la cathédrale (tours, contreforts, annexes, flèche). L'aire de l'Hôtel de Ville calculée via cette projection locale (10 251,55 m²) diffère de la surface polygonale Lambert-93 utilisée dans le diagnostic raster (~10 275,3 m²). Il ne faut pas fusionner ces chiffres ni en déduire une précision architecturale au centimètre. Il faut réexaminer l'emprise, la projection, la zone de toiture et les surfaces comparables.

Le bâtiment IGN Hôtel de Ville conserve **4 anneaux / 592 sommets** (enveloppe et cours). Le jeu dispose aussi de **11 parties cadastrales/volumétriques Ville de Paris** associées à cette emprise, couverture déclarée **0,831**. Le moteur impose actuellement `coverage >= .90`, d'où le non-remplacement par de fausses subdivisions 3D ; `src/volumeGeometry.ts` confirme que la hauteur des subdivisions est modélisée par approximation. **Ces 11 polygones ne sont PAS onze volumes aux altitudes complètes garanties.**

---

# 6. Relevé LiDAR : la véritable réalisation récente

**Pipeline existant :** `scripts/prepare_lidar_roofs_4e.py`, workflow `.github/workflows/prepare-lidar-roofs.yml`, liste de dalles `data/quality/lidar-4e-availability.json`. Récupération depuis IGN Géoplateforme, WMS raster de **MNH LiDAR HD** en GeoTIFF, contrôle projection/résolution, rasterio/shapely/pyproj, échantillonnage intérieur et triangulation des toitures. Les hauteurs sont des **hauteurs au-dessus du terrain**, pas des cotes d'exécution de chaque élément de la charpente.

**Historique réel du débogage de l'Hôtel de Ville :**

1. Première tentative : bâtiment IGN complexe de 592 sommets rejeté par une ancienne limite de 500 points et/ou bordures non renseignées.
2. Tolérance augmentée uniquement pour cet objet, grille 2,5 m, maximum 3 600 points, exigence d'au moins 95 % de couverture triangulée, sans inventer de hauteur.
3. Diagnostic : une seule dalle, donnée manquante pour **181/362 sommets du contour extérieur** ; le bâtiment chevauche deux dalles (`metadata.11924`, `metadata.57713`) ; téléchargement de la première perturbé par une erreur HTTP 504.
4. Mise en place d'une récupération résiliente : repli de la dalle WMS 2000x2000 en quatre sous-dalles 1000x1000 lorsque le service rencontre une erreur 502/503/504 ; mosaïquage **sans interpolation** avec `rasterio.merge`, même géoréférencement EPSG:2154 et pixel 0,5 m.
5. Le résultat de mosaïque a ramené la mesure manquante en bordure à **1/362** ; recherche d'un pixel mesuré dans 16 directions sur 0,5–2 m, strictement à l'intérieur du polygone, sans fabriquer de valeur de hauteur.
6. Une tentative suivante a été refusée par le filtre général sur la hauteur 90e percentile : la superposition de pavillons et du campanile dépasse l'attribut du corps principal IGN 25,2 m. Référence indépendante officielle : **campanile décrit à 50 m par la Ville de Paris**, valeur arrondie ; contrôle spécifique, sans prétendre que l'édifice entier mesure 50 m.
7. Version intégrée : toiture acceptée et rapport reproductible, mais ce n'est toujours pas la façade exacte ; aucune corniche ou statue n'a été déduite artificiellement des pixels.

**Chiffres du rapport de validation en dépôt `data/quality/lidar-4e-reconstruction.json` :**

```json
{
  "coveredBuildings": 2696,
  "validatedBuildings": 1748,
  "rejectedBuildings": 948,
  "hotelDeVilleTarget": "BATIMENT0000000245157267",
  "hotelDeVilleRoofAccepted": true,
  "hotelDeVilleRoofTriangleCoverage": 0.9826,
  "hotelDeVilleDiagnostic": {
    "reason": "accepted-mosaic",
    "sourceTiles": ["metadata.11924", "metadata.57713"],
    "mosaicDimensions": [2000,4000],
    "pixelSizeMeters": 0.5,
    "gridMeters": 2.5,
    "candidatePoints": 2048,
    "acceptedTriangles": 3490,
    "acceptedVertexSamples": 2047,
    "triangulatedCoverage": 0.98258,
    "heightMedianM": 26.84,
    "heightP90M": 35.65,
    "ignBuildingHeightM": 25.2,
    "publishedCampanileHeightM": 50.0,
    "maximumMnhSampleM": 48.21
  }
}
```

**Provenance de la cote de campanile :** https://www.paris.fr/pages/l-hotel-de-ville-abrite-cinq-lieux-insolites-7659. La valeur publiée 50 m est descriptive, **arrondie**. Le 48,21 m est une **mesure maximale échantillonnée** dans le produit MNH ; ni l'une ni l'autre ne garantit une restitution centimétrique du campanile.

**État visuel exact à vérifier :** les 3 490 triangles sont effectivement présents dans `public/data/4e/roof-lidar.json` et la scène du 4e tente de les utiliser via `TileManager`. Le résultat reste une surface de toiture partielle (98,26 % de l'aire couverte selon la méthode actuelle) et un ensemble de murs issus de l'extrusion du polygone IGN, **pas** une véritable maquette architecturale Ballu/Deperthes. Contrôler visuellement les **1,74 % non triangulés**, les raccords de cours et toitures, la position des fenêtres, les pentes et la cohérence des hauteurs à la mise en scène. Une « valeur mesurée » LiDAR à 2 m en retrait d'un bord reste un échantillon réel mais ne représente pas nécessairement exactement la hauteur de ce point de bord : documenter cet écart spatial.

**Autres documents techniques :** `tests/test_lidar_mosaic_026.py`, `tests/test_lidar_renderer.py`, `tests/test_lidar_roof_source.py`, `scripts/inspect_lidar_4e.py`, `scripts/prepare_architecture_survey_4e.py`.

---

# 7. Sources architecturales officielles : instruction systématique

Les **six familles exigées** doivent être exploitées dans chaque dossier, selon leur disponibilité, **avant** de construire des détails géométriques déclarés certifiés :

1. **Archives de Paris** : https://archives.paris.fr — permis, plans cotés, coupes, élévations, archives des transformations et travaux ; attention aux projets non exécutés.
2. **Médiathèque du patrimoine et de la photographie (MPP)** : https://mediatheque-patrimoine.culture.gouv.fr — dossiers et relevés de monuments historiques, archives de restauration et détails, certains **consultables uniquement sur place**.
3. **Gallica / Bibliothèque nationale de France** : https://gallica.bnf.fr — éditions d'architectes, planches historiques et ouvrages techniques ; vérifier l'échelle et la date.
4. **Cité de l'architecture et du patrimoine** : https://www.citedelarchitecture.fr — fonds d'architectes, plans, relevés, maquettes historiques.
5. **IGN LiDAR HD** : https://geoservices.ign.fr/lidarhd — nuages de points, toits, volumes et surfaces visibles ; le MNH n'est pas une capture de toute l'architecture sculptée ni des intérieurs.
6. **Open Data Paris** : https://opendata.paris.fr — emprises et « volumes bâtis », jeux municipaux. Vérifier dates, exactitude, nomenclatures et licence.

**Deux sources complémentaires essentielles pour le pilote :** [Bibliothèque de l'Hôtel de Ville](https://bibliotheques-specialisees.paris.fr), qui héberge de réels **cahiers de calepinage et d'exécution**, et [Paris Musées / Carnavalet](https://www.parismuseescollections.paris.fr), qui expose des dessins et manifestations **IIIF**. Le statut de consultation et de réutilisation doit être revu document par document, notamment avant téléchargement et redistribution d'images.

**Métadonnées requises par pièce :** institution, collection, cote/ARK/IIIF, auteur/architecte, date de projet, date d'exécution, époque représentée, type (plan/élévation/coupe/détail/échantillon raster), unités, échelle, valeur numérique de chaque cote réellement lue, précision explicite/estimée, transformation géoréférencée, mode d'accès, licence et preuve d'actualité de l'élément architectural. Ne jamais confondre **format physique de feuille**, **dimension du dessin reproduit** et **dimension réelle de l'édifice**.

## 7.1 Corpus Hôtel de Ville à analyser en premier

**Identifiant POP/Mérimée :** `PA00086319` ; bâti actuel issu de la reconstruction de Théodore Ballu et Édouard Deperthes après la destruction de 1871.

**Sept références actuellement dans `dossiers.json` :**

1. **`bhdv-cc64-pl34` — `CC64_PL34` (1878).** Façade sur place de l'Hôtel-de-Ville, XIVe assise et coupe. Lien d'images/archives : https://bibliotheques-specialisees.paris.fr/in/imageReader.xhtml?ark=73873%2Fpf0000712758%2F0034%2Fv0001.simple.selectedTab%3Drecord.hidesidebar&id=ark%3A%2F73873%2Fpf0000712758%2F0034&selectedTab=record&updateUrl=updateUrl
2. **`bhdv-cc16-pl39` — `CC16_pl39` (1878).** Tourelle côté Préfet, XIIIe assise ; plans, coupes, élévations et détail des baies. https://bibliotheques-specialisees.paris.fr/in/imageReader.xhtml?ark=73873%2Fpf0000570031%2F0039%2Fv0001&id=ark%3A%2F73873%2Fpf0000570031%2F0039&updateUrl=updateUrl
3. **`bhdv-cc76-pl04` — `CC76_PL04` (1881).** Détails/profils de façade Boccador au deuxième étage, approuvés pour exécution. https://bibliotheques-specialisees.paris.fr/in/imageReader.xhtml?ark=73873%2Fpf0000570575%2F0004%2Fv0001&id=ark%3A%2F73873%2Fpf0000570575%2F0004&updateUrl=updateUrl
4. **`carnavalet-wuhrer-serie`.** Série de douze planches de plans et élévations du nouvel Hôtel de Ville : https://parismuseescollections.paris.fr/fr/musee-carnavalet/oeuvres/serie-de-12-planches-presentant-les-plans-et-elevations-du-nouvel-hotel-de
5. **`carnavalet-wuhrer-facade`.** Élévation de la façade principale, planche 5 : https://www.parismuseescollections.paris.fr/fr/musee-carnavalet/oeuvres/hotel-de-ville-de-paris-facade-principale — IIIF : https://apicollections.parismusees.paris.fr/iiif/320291169/manifest
6. **`carnavalet-deslandes-plan`.** Plan de l'ensemble reconstruit, dessin Deslandes daté approximativement 1908–1914 : https://www.parismuseescollections.paris.fr/fr/musee-carnavalet/oeuvres/hotel-de-ville-de-paris-plan-actuel-de-l-hotel-de-ville-reconstruit-par — IIIF : https://apicollections.parismusees.paris.fr/iiif/320064500/manifest
7. **`ville-paris-campanile-hauteur`.** Source institutionnelle Ville de Paris, campanile **50 m** (arrondi) : https://www.paris.fr/pages/l-hotel-de-ville-abrite-cinq-lieux-insolites-7659

**État honnête d'exploitation :** les documents d'exécution ont été identifiés et indexés, mais leurs **cotes architecturales détaillées n'ont pas encore été déchiffrées, calibrées, tabulées et géoréférencées** dans les données du jeu. Une seule valeur de hauteur institutionnelle du campanile est dans les `measurements` de l'Hôtel de Ville, avec mention explicite de son arrondi. Il est donc faux de dire que ses colonnes, lucarnes, pignons et statues ont été reproduits à leurs dimensions. **Travail immédiat pour Claude : extraire et documenter les cotes réellement inscrites sur les pièces ci-dessus, identifier les vues complémentaires nécessaires et produire le premier relevé 3D soumis à audit, sans extrapoler au-delà des preuves.**

## 7.2 Autres dossiers de départ

- **Tour Eiffel `PA00088801`** : 3 documents institutionnels/ouvrages et **6 dimensions arrondies** dans `dossiers.json` : hauteur actuelle 330 m, largeur de base 125 m, pied 25 m, étages à 57 / 115 / 276 m. Source : https://www.toureiffel.paris/fr/le-monument/chiffres-cle ; ouvrages et planches originales à rechercher dans Gallica. **Le treillis, la courbure des pieds, les poutres et rivets ne sont pas modélisés.**
- **Notre-Dame `PA00086250`** : 1 entrée de recherche dans les fonds MPP, **0 cote architecturale transcrite** ; l'architecture actuelle doit tenir compte des transformations et restaurations depuis 2019, dont la flèche. Ne pas créer Notre-Dame avec la seule emprise IGN.
- **Arc de Triomphe `PA00088804`** : 1 source CMN, **une hauteur générale arrondie 50 m**, aucune coupe cotée détaillée transcrite ni maillage de reliefs.

La fiche d'inventaire couvre **195 édifices**, mais seulement **4 dossiers** ont à ce jour des recherches documentaires spécifiques dans le registre (Hôtel de Ville, Eiffel, Notre-Dame, Arc de Triomphe). Les autres 191 sont des éléments à instruire, et non des modèles finis.

---

# 8. Inventaire prioritaire et palette des bâtiments

**Fichier consultable dans le jeu :** `public/data/metropole/places/landmark-catalog.json` ; `src/landmarkBrowser.ts` (bouton **P**, recherche, filtres, bouton Voir). **Registre documentaire :** `public/data/metropole/architecture/dossiers.json`. **Notice géolocalisée large :** `public/data/metropole/places/monuments.json`, 2 284 enregistrements POP en corpus, dont certains au-delà de Paris intra muros ; **ne pas** les présenter tous comme des monuments de la commune de Paris.

**Comptage priorité (somme = 195) :**

| Rôle dans le jeu | Teinte UI | Enregistrements du registre |
|---|---|---:|
| Politique / administration | `#eac49f` orange léger | 51 (28 refs POP ; 23 candidats) |
| Tourisme / patrimoine | `#ded0b9` beige | 36 (30 refs ; 6 candidats) |
| Culture / arts | `#c8b9df` violet clair | 71 (53 refs ; 18 candidats) |
| Économie / commerce / finance | `#b3cce3` bleu clair | 37 (29 refs ; 8 candidats) |

**140** entrées possèdent une référence POP appariée dans le catalogue ; **55** restent sans référence/maillage fiable. Ce n'est pas l'inventaire de tous les édifices de Paris. Le moteur associe surtout **un point POP à une empreinte IGN** ; les grands ensembles (Louvre, Palais-Royal, ministères, bâtiments avec cours multiples) ne sont pas nécessairement segmentés au bon niveau. Le codage d'une emprise entière peut cacher des usages mixtes et des dates différentes. Les détails iconiques sans référence appariée ne sont pas inventés.

Le rôle interne TS `financial` couvre également l'**économique**, au-delà de la finance. Le reste du bâti doit demeurer blanc/gris. **À auditer** : la fonction `roleOfHeritage()` classe par défaut d'autres notices patrimoniales en `touristic`, ce qui peut rendre beaucoup de bâtiments ordinaires en beige ; envisager un traitement plus conservateur limité aux cibles réellement prioritaires, avec règle explicite de coexistence des fonctions. Ne pas inférer un ministère ou une banque de la proximité ou du nom historique seul.

---

# 9. Infra 3D de maquettes architecturales certifiées — EXISTANTE MAIS VIDE

**Clé de vérité :** `public/data/metropole/architecture/models/index.json` :

```json
{
  "schema": 1,
  "coordinateSystem": "paris-local-xyz",
  "unit": "m",
  "models": [],
  "notice": "Aucune maquette cotée détaillée n'est encore certifiée."
}
```

**Dans `src/architectureDossiers.ts` :**

- Chargement du registre des 195 dossiers (`schema:1`) et des trois relevés 4e.
- `forReference(ref)` retourne un dossier patrimonial ; `appendTo` crée dans la fiche existante un volet « Plans, mesures et fidélité du monument » ; aucune nouvelle interface générale.
- `canPublish(ref, sourceIds)` refuse la publication si `publicationAllowed !== true` ou si le modèle ne cite pas des documents existants. **Tous les dossiers actuels sont `publicationAllowed:false`**.

**Dans `src/architectureModels.ts` :**

- `ArchitecturalModelLibrary.init()` charge `models/index.json`, filtre les entrées : identifiant `PA########`, coordonnées numériques, `fullReplacement===true`, `review==='measured-and-approved'`, dossier pouvant publier et plusieurs niveaux LOD décrits.
- Chaque fichier détaillé doit suivre le modèle conceptuel :

```jsonc
{
  "schema": 1,
  "ref": "PA00086319",
  "units": "m",
  "coordinates": "paris-local-xyz",
  "tier": "high",
  "sourceIds": ["bhdv-cc64-pl34"],
  "parts": [
    {
      "name": "nom-significatif-de-piece",
      "kind": "wall",
      "positions": [/* x,y,z en coordonnées locales de SCÈNE ; NON coordonnées relatives au centre d'objet */],
      "indices": [/* indices triangulaires 0-based */],
      "sourceIds": ["bhdv-cc64-pl34"]
    }
  ]
}
```

L'exemple ci-dessus est un **contrat de format, pas un modèle réel**. Ne générer aucun faux `positions` sous prétexte d'illustration. Types autorisés `wall`, `roof`, `detail` ; tous les sommets finitis et indices stricts ; limites par maillage ~180 000 sommets, ~300 000 triangles et 400 parties ; **ce ne sont pas des objectifs de performance Android**, seulement des seuils de validation du chargement.

**Index attendu (format d'un modèle réellement certifié, une fois les contrôles achevés) :**

```json
{
  "ref": "PA00086319", "x": -85.9, "z": 214.2,
  "sourceIds": ["bhdv-cc64-pl34", "bhdv-cc16-pl39"],
  "fullReplacement": true,
  "review": "measured-and-approved",
  "lods": [
    {"tier":"high", "maxRadiusMeters":650, "file":"PA00086319-high.json"},
    {"tier":"medium", "maxRadiusMeters":1500, "file":"PA00086319-medium.json"},
    {"tier":"low", "maxRadiusMeters":2500, "file":"PA00086319-low.json"}
  ]
}
```

**Cet index est purement illustratif** : les seuils LOD, sources suffisantes, englobants, coordonnées d'origine et statut de validation sont à **calculer et vérifier**. `sourceIds` référencent des pièces documentaires ; ils ne sont pas, à eux seuls, des preuves de cotation correcte : lire et contrôler chaque cote effectivement utilisée.

**Masque de remplacement :** les bâtiments ordinaires sont regroupés en batches par matériaux ; `applyArchitecturalMask(mesh)` enregistre leurs indices d'origine dans `WeakMap<Mesh,Snapshot>`, exclut les triangles portant le `heritageRef` d'un modèle maître réellement chargé, restaure les triangles si le modèle disparaît, et évite de masquer les voisins. `activeRefs` est global ; `maskAll(scene)` traverse les meshes à chaque changement de modèle. LOD actuellement sélectionné à partir du rayon de caméra (<650 m high ; <1500 m medium ; sinon low), avec cadence ~450 ms, trois modèles proches au maximum, puis chargement `fetch` JSON, `Mesh/VertexData`, calcul des normales.

**POINTS DE RISQUE À AUDITER AVANT PREMIER MASTER :**

1. Aucune maquette réelle n'a éprouvé le cycle chargement → masquage IGN → sélection → changement de LOD → retour arrière → sauvegarde ; les tests actuels vérifient surtout des contrats et du texte source.
2. Les meshes experts sont marqués `isPickable=false`. Si l'extrusion IGN est masquée, la sélection du monument peut être perdue. Concevoir une surface de picking cohérente indépendante de la représentation, attachée au même identifiant patrimoine.
3. Les sommets de JSON sont utilisés **directement dans le repère mondial x/y/z de scène**. Aucune translation d'objet ou recalage EPSG n'est appliqué par le loader : exporter le master dans un mauvais repère déplacerait le monument ou le ferait flotter.
4. Les matériaux n'ont que les catégories `wall/roof/detail` (detail rendu comme mur). Pour des maquettes haute fidélité, il faudra éventuellement des sous-parties certifiées par matériau, face ou époque, sans réintroduire de fausse texture ou un z-fighting.
5. Le maillage d'origine peut être fusionné en batches ; masquer les triangles **tous les 450 ms** ou à chaque transition doit être profilé (CPU, GPU, mémoire, GC). Le code utilise `mesh.setIndices()` ; mesurer le coût réel sur Android.
6. Pas d'outillage complet pour valider orientation des triangles, normales, arêtes non-manifold, conservation des trous/cours, altitudes de base, erreurs d'échelle, collision, occlusion, défilement et LOD avec caméra en mouvement.
7. La présence d'une source listée ne garantit pas un « modèle vérifié » ; exiger des **mesures numériques reliées à une pièce et à un emplacement de cette pièce** ainsi qu'une validation de forme avec tolérance justifiée.
8. Un **LOD bas** doit être un dérivé simplifié contrôlé du master, non un monument de cube arbitraire ; les distances de bascule doivent être testées à l'écran pour éviter le popping.
9. La logique `activeRefs` filtre par référence patrimoine attachée à la géométrie ; certaines références POP complexes correspondent à **plusieurs bâtiments IGN** ou à une partie d'un bâtiment. Une table de correspondance plusieurs-à-plusieurs est indispensable pour des ensembles comme Hôtel de Ville, palais, Louvre et cathédrales.
10. Ne pas considérer la couverture LiDAR de toiture validée comme équivalente au **fullReplacement** de l'ensemble architecturé : si l'on publie seulement un toit, conserver correctement les murs et les objets du bâti non remplacés.

Claude doit proposer une architecture robuste pour résoudre ces problèmes avant de déclarer `publicationAllowed=true`.

---

# 10. Éléments de jeu et d'interface à conserver sans régression

- **Caméra :** Babylon `ArcRotateCamera` avec entrées par défaut supprimées et gestes tactiles propres (`src/mobileCamera.ts`, `src/cameraGestures.ts`). Rayons autorisés ~12 à 26 000 m ; prévisualisation orbite/rue ; transitions animées, pan, yaw, pitch, zoom, `flyTo`. Conserver les contrôles et l'inertie.
- **FPS :** `src/adaptiveResolution.ts` ajuste la résolution GPU à intervalles espacés ; seuils internes FPS lissés et frein au changement pendant rotation. Qualité d'affichage n'est pas équivalente à modification des formes géométriques.
- **Quartiers :** `urbanAtlas.ts` ne reconnaît `quartersReady` que si 80 contours sont chargés, `QuarterOverlay` et sélection par carte/liste, statut et données historiques ; 20 arrondissements, 80 quartiers. Ne pas confondre quartier, arrondissement, mairie Paris Centre, quartier historique ou commune voisine.
- **Monuments :** bouton `P`, recherche et filtres 4 rôles, liens de sources et `flyTo`; en l'absence de point sûr, ne pas inventer les coordonnées.
- **Gestion municipale :** `src/simulation/cityEngine.ts` contient des modèles de projet, procédures et votes **simulés**, délais et indicateurs ; ce n'est pas un modèle économique complet de la Ville de Paris. `GameManagement` orchestre les écrans et actions.
- **Sauvegardes :** `src/simulation/saveStore.ts` et `ui.ts` utilisent IndexedDB, sauvegarde automatique, export/import JSON, vues caméra optionnelles ; les schémas `SAVE_SCHEMA=1`, `BUNDLE_SCHEMA=1` ne doivent pas être modifiés sans migration. PWA et APK **ne partagent pas leur base locale** ; ne pas effacer le stockage automatiquement pour « réparer » une mise à jour.
- **Horloge :** `src/gameClock.ts` fait partie du gameplay ; conserver, sans imposer le retour d'effets visuels jour/nuit.
- **Cartographie complète :** le panorama est agrégé à 50 m ; ce sont des cellules représentant la **présence bâtie**, pas la géométrie de chacune des 287 075 empreintes. Le modèle proche est chargé sélectivement pour maintenir les FPS.
- **Web/PWA :** GitHub Pages sous `/Paris-le-jeu/`, `vite.config.ts` choisit cette base dans Actions ; en Capacitor `CAPACITOR_BUILD=true` signifie ressources relatives `./`. Ne pas casser les `fetch(import.meta.env.BASE_URL+...)`.
- **PWA :** enregistrement `registerType:'prompt'`, bouton de mise à jour via `src/appInstall.ts`. En conteneur natif, service worker désactivé. Conserver l'accès hors ligne lorsqu'il existe, ne pas prétendre que toutes les 287 075 géométries sont déjà mises en cache.
- **Textures aériennes :** il existe encore un répertoire historique `public/data/4e/aerial/*.jpg`, mais le rendu courant l'ignore / le build final le retire. **Ne pas le réactiver.**

---

# 11. Données de Paris déjà présentes : quantités et qualités

| Sous-système | Données/rapport | Couverture connue / avertissement |
|---|---|---|
| Bâtiments métropolitains | `public/data/metropole/buildings/manifest.json` | 287 075 objets IGN ; 29 communes limitrophes en plus de Paris ; ~87 990 666 octets de fichiers JSON sources ; tuiles 800 m |
| Bâtiments détaillés 4e | `public/data/4e/manifest.json` + `tiles/*.json` | 2 696 bâtis, 27 tuiles 300 m ; ~2 520 hauteurs non estimées et 176 estimées |
| Volumes bâtis Ville de Paris | `public/data/4e/city-volumes.json`, `data/quality/maquette-4e.json` | 8 664 volumes source pour le 4e, 894 bâtiments liés selon audit, certaines subdivisions non utilisables comme cotes de hauteur |
| LiDAR toits | `public/data/4e/roof-lidar.json` + rapport qualité | 1 748 toitures acceptées sur 2 696 dans le secteur 4e ; ne prouve aucune façade sculptée |
| Formes de toit OSM | `public/data/4e/roof-shapes.json` | Quelques dizaines de formes documentées, beaucoup sans hauteur ; sorties procédurales souvent estimées |
| Notices patrimoniales | `public/data/metropole/places/monuments.json` | 2 284 notices POP enregistrées, certaines au-delà de Paris |
| Inventaire ciblé | `public/data/metropole/places/landmark-catalog.json` | 195 édifices ; 140 POP appariés et 55 candidats |
| Relevés architecturaux | `public/data/metropole/architecture/survey-4e.json` | 3 associations IGN/POP (Hôtel de Ville, Notre-Dame, Saint-Gervais) ; 1 toit MNH accepté (Hôtel de Ville) |
| Dossiers sources | `public/data/metropole/architecture/dossiers.json` | 195 entrées ; 4 dossiers enrichis de documents ; zéro dossier globalement certifié |
| Maquettes monumentales | `public/data/metropole/architecture/models/index.json` | **0 fichier de modèle certifié** |
| Terrain | `public/data/metropole/terrain/manifest.json` + grille | RGE ALTI, maille 200 m, bilinéaire ; non adéquat pour détailler chaque escalier/assise de colonne |
| Atlas panoramique | `public/data/metropole/overview/` et `coverage/` | Agrégation et LOD, non forme architecturale individuelle de tous les bâtiments |
| Quartiers et voies | génération `scripts/prepare_urban_history.py` | 80 quartiers et ~6 625 voies selon les derniers logs Actions ; vérifier leur millésime et leurs limites exactes |
| Surfaces et arbres | `public/data/metropole/surfaces/`, `trees/*.bin` | Données géographiques complétées par représentations ou simplifications selon source |

**Sources et droits :** `CREDITS_DONNEES.md` et `data/sources/licences.json`. Les données Ville de Paris/OSM peuvent être soumises à ODbL ; IGN LiDAR HD à licence ouverte et conditions du fournisseur ; planches IIIF et archives ont des droits **propres aux documents et aux reproductions**. Vérifier explicitement les droits d'extraction, modification, distribution des dérivés dans le jeu et l'APK. Une URL librement consultable ne prouve pas une autorisation de redistribution de fichiers numérisés.

---

# 12. Erreurs rencontrées, diagnostics, corrections et leçons

**A. Défaut architectural initial (TOUJOURS NON RÉSOLU).** Le bâti important apparaît comme une extrusion IGN plus ou moins recouverte d'un toit plausible ; il n'a ni travées, ni fenêtres exactes, ni sculptures. Cela a déclenché le rejet explicite de l'utilisateur. Les couleurs et notices ne répondent pas au problème de fidélité. La priorité n°1 est de produire une **vraie maquette** et non de recenser indéfiniment d'autres monuments.

**B. Hôtel de Ville MNH (RÉSOLU AU NIVEAU TOITURE SEULEMENT).** Rejet des 592 sommets par plafond algorithmique ; une dalle manquante à cause HTTP 504 ; mosaïque 2 dalles ; échantillons proches vérifiés ; contrôle multi-hauteurs du campanile. Rapport final accepté : 3 490 triangles, 98,26 % de couverture de toiture. Les façades restent non documentées numériquement.

**C. Version Web / Android invisible (RÉSOLU POUR LE PATCH 0.26.4).** Les modifications antérieures étaient fusionnées sous l'étiquette 0.26.3 ; une compilation antérieure précédait la donnée LiDAR finale. Un changement explicite de version 0.26.4 a été livré. Des tests anciens contenaient six assertions « version exactement 0.26.3 » et faisaient échouer **les trois workflows** (Web, validation, APK). Correction : garder un verrou sur la famille **0.26.x**, vérifier `src/release.ts` contre `package.json`, sans bloquer les patches. Un workflow PR `release-validation.yml` a exécuté les tests + audit + TypeScript. **Le nouveau trio d'Actions 0.26.4 a réussi le 9/11/2026**.

**D. Environnement de tests (RÉSOLU).** L'exécution des 147 tests sur une branche PR échouait faute de fichier généré `public/data/metropole/coverage/manifest.json` ; nouveau workflow génère d'abord overview et coverage. Ce n'était pas un bogue du moteur, mais une dépendance de pipeline CI qui n'était pas préparée.

**E. Documents historiques incohérents (À CORRIGER).** Certains textes présents dans `docs/ARCHITECTURE_FIDELITE.md`, `docs/INVENTAIRE_MONUMENTS.md`, le README ou `docs/RECETTE_ANDROID.md` évoquent encore 0.26.3 / 0.25 ou une « toiture MNH non validée » alors qu'un passage ultérieur du même document acte son acceptation. Le code et les derniers rapports font autorité pour l'état actuel 0.26.4. Claude doit **harmoniser les sections contradictoires et ajouter dates/commit aux constats**, sans transformer un toit accepté en façade certifiée.

**F. Limite de validation.** GitHub Actions n'a pas exécuté une véritable recette graphique/tactile sur Android. Aucun chiffre de FPS réel ni métrique photo–maquette validée n'est établi. L'APK de test compilé est une preuve de build, pas d'ergonomie satisfaisante.

---

# 13. Comment reproduire, compiler et tester

Cloner le dépôt public et se placer **sur le SHA de référence** avant toute modification :

```bash
git clone https://github.com/meyameya677-sketch/Paris-le-jeu.git
cd Paris-le-jeu
git checkout f1c018df788e6d0fc8ee6248d5f35e1e4cb11ed5
# Créer ensuite une branche de travail pour éviter d'altérer le commit témoin.
node --version           # Node 22 préférable, au moins 20.19
python --version         # Python 3.12 en CI
npm install --no-audit --no-fund
python -m pip install 'numpy>=2,<3' 'rasterio>=1.4,<2' 'shapely>=2.1,<3' 'pyproj>=3.6,<4'
python scripts/prepare_metropole_overview.py
python scripts/prepare_city_coverage.py
python -m unittest discover -s tests -p 'test_*.py' -v
python scripts/audit_architectural_models.py
python scripts/audit_heritage_releases.py
npx tsc --noEmit
npm run build
```

**Attention :** les tâches géographiques de build Web et Android appellent aussi les générateurs de surfaces, voies, jardins et quartiers ; `npm run build` sur un clone frais peut nécessiter une préparation des artefacts générés dans les workflows. Se référer à `.github/workflows/deploy.yml`, `.github/workflows/build.yml`, `.github/workflows/android-apk.yml` pour les **ordres exacts**. Certains scripts ont besoin du réseau public pour charger les sources IGN, OSM ou Paris Data ; les téléchargements sont explicitement hors du chemin de rendu du téléphone.

**Tests architecturaux importants :**

```bash
python scripts/audit_architectural_models.py
python -m unittest discover -s tests -p 'test_architecture_dossiers_026.py' -v
python -m unittest discover -s tests -p 'test_architecture_survey_026.py' -v
python -m unittest discover -s tests -p 'test_lidar_mosaic_026.py' -v
python -m unittest discover -s tests -p 'test_lidar_renderer.py' -v
node --experimental-strip-types scripts/check_architectural_detail.mjs
```

La suite totale a exécuté **147 tests** (plus quelques cas ignorés) dans le workflow validé, mais Claude doit lui-même relever le résultat de ses exécutions plutôt que de réemployer aveuglément cet historique. **Versioning :** la montée à une révision exige un nouveau dossier patrimonial réel suivant `data/heritage-release.json` et `scripts/audit_heritage_releases.py` ; ne pas modifier ces tests en les affaiblissant pour faire passer des cotes inventées.

**Contrôle Android :** comparer Web Chrome Android, PWA installée et APK (même zone, même zoom, même qualité), noter le modèle de téléphone, version Android, GPU/WebGL, FPS moyen et plancher, freezes, temps de chargement, mémoire, temps de réaction gestuelle, LOD popping, sélection, partie sauvegardée, export/import, navigation panoramique et retour au 4e. Réutiliser `docs/RECETTE_ANDROID.md` tout en corrigeant ses anciennes références de version.

---

# 14. Analyse critique : pourquoi la maquette « parfaite » n'existe pas encore

Le jeu sait **placer** des bâtiments, extruder une emprise, échantillonner un toit, afficher une fiche et gérer un LOD de secteur. Il ne sait **pas encore** transformer des planches d'archives en une géométrie architecturale détaillée vérifiée.

Les **composants manquants** de la chaîne sont :

1. Un téléchargement/registre de documents source **au niveau des feuilles**, avec métadonnées IIIF/ARK, statut de reproduction et licences clairs.
2. Un outil d'extraction **manuelle/assistée et vérifiée** des cotes réellement inscrites : altitudes de corniches, largeurs de travées, distances entre axes, dimensions/sections de colonnes, ouvertures, arcs, déformations éventuelles du plan, plans de niveaux et coupes.
3. Un **référentiel architectural géoréférencé** : identification de l'aile et de la façade auxquelles appartient chaque cote, système de coordonnées, alignements et marges d'erreur. Ne pas contraindre artificiellement le dessin historique à une emprise actuelle différente.
4. Une **modélisation à partir de contraintes** et non de proportions « jolies » : surfaces, volumes, profils, pleins/vides, courbes architecturales, sections, archivage des incertitudes. Si une cote manque, classer l'élément `inconnu`, avec possibilité de rendu neutre explicitement non certifié ; ne pas annoncer précision parfaite.
5. Une séparation **historique / état actuel** : l'Hôtel de Ville de 1880 et le monument visible en 2026 ne doivent pas être confondus. Relever les travaux et restaurations documentés.
6. Une **validation indépendante** par points métriques : résidus de géoréférencement, écarts entre point d'exécution et LiDAR actuel, métriques sur les fenêtres, arches, galeries, hauteurs, fermetures des cours, hauteurs de toiture, absence de triangles auto-intersectants. Une valeur arrondie n'autorise pas une validation au millimètre.
7. Des **maillages complets** avec normales cohérentes, subdivisions par façade, détails architecturaux distincts, matériaux monochromes fonctionnels et une méthode de LOD simplifiée à erreur contrôlée.
8. Un **outillage de remplacement non destructif** du bâtiment dans Babylon.js (picking et gameplay préservés) et une mesure de performance sur Android.
9. Un circuit de **validation et publication** : `publicationAllowed:true` uniquement après audit source + métrique + mesh + rendu. La 0.27 ne peut être annoncée que quand ce circuit est démontré sur au moins un monument important et validé avec l'utilisateur.

**Priorité rationnelle : l'Hôtel de Ville comme monument pilote**. Il est central dans le jeu, avec inventaire des planches d'exécution réel, une emprise complexe (592 sommets), plusieurs cours et un relevé MNH 2026 accepté. Une fois cette chaîne robuste, elle sera réutilisable pour Notre-Dame, Louvre, Palais Bourbon, Sénat, Palais-Royal, Opéra Garnier, Grand Palais, Arc de Triomphe, Panthéon, tour Eiffel et autres. **Ne pas essayer de fabriquer immédiatement 195 maquettes inexactes** : l'utilisateur demande la fidélité, non un score de complétude factice.

---

# 15. Proposition d'architecture de données de niveau expert — à examiner, pas déjà implémentée

**C'est une proposition à valider**, pas une description du code existant. Elle doit cohabiter avec le `dossiers.json` existant et ne doit pas écraser son schéma sans migration.

Créer par monument une arborescence cohérente :

```text
public/data/metropole/architecture/
  dossiers.json                             état patrimonial existant
  survey-4e.json                           associations et métrés existants
  models/index.json                        zéro maquette certifiée aujourd'hui
  plans/PA00086319/sources-manifest.json   catalogue des feuilles + licence + checksum
  measurements/PA00086319.json             cote par cote, unité, référence, géométrie, incertitude
  registration/PA00086319.json             GCP, transformation, résidus, EPSG, millésimes
  quality/PA00086319.json                  couverture, écarts, trous, métriques, approbations
  reference/PA00086319.*                    master source (format à décider, réutilisation autorisée)
  models/PA00086319-high.json              maillage du moteur certifié — non présent encore
  models/PA00086319-medium.json            dérivé simplifié du master — non présent encore
  models/PA00086319-low.json               dérivé simplifié du master — non présent encore
```

**Proposition de structure d'une mesure** (valeurs fictives volontairement omises) :

```json
{
  "elementId": "facade-est/travee-03/largeur-ouverture",
  "property": "clear_width",
  "value": null,
  "unit": "m",
  "status": "not-yet-transcribed",
  "sourceId": "bhdv-cc64-pl34",
  "sheetLocator": null,
  "dateRepresented": "1878",
  "currentStateVerified": false,
  "uncertaintyMeters": null,
  "verificationMethod": null,
  "notes": "Le champ value reste null tant que la cote n'a pas été réellement relevée."
}
```

**Quand la cote existe :** remplacer `null` par la valeur effectivement lue, enregistrer la citation et le point exact de la feuille, l'échelle, la précision de lecture, les unités et l'incertitude. Documenter le contrôle actuel. Les cotes conflictuelles doivent rester toutes visibles avec un état `conflict`, non être résolues arbitrairement par moyenne. Les éléments inconnus sont identifiés dans le rendu, sans présenter leurs contours comme exacts.

**Stockage des vrais modèles :** étudier glTF 2.0/GLB et les modes de compression adaptés aux mobiles (meshopt/Draco ou équivalent), avec master de géométrie source séparé et licence vérifiée. Ne pas imposer GLB si l'intégration du moteur existant n'est pas correctement étudiée. Les JSON actuels à longues listes de nombres peuvent être lourds ; mesurer transfert réseau et mémoire, GPU, nombre de draw calls, indépendance des instances et LOD. Optimisations non destructives : instances pour répétitions **documentées**, frustum/occlusion culling, chargement à proximité, budgets mémoire et streaming, simplification multi-résolution avec erreur géométrique quantifiée. Aucune optimisation ne doit altérer le master ni servir d'alibi à l'invention de détails.

---

# 16. Plan d'action demandé à Claude (priorités et livrables)

## P0 — prise de possession, audit et correctifs de sécurité/fidélité

1. **Cloner ou ouvrir le commit SHA**, constater l'état réel, vérifier les build logs de la 0.26.4 et les données LiDAR en place. Produire un **rapport d'écarts observés** entre ce document et le dépôt éventuellement plus récent.
2. Vérifier que `ArchitectureDossiers` et `ArchitecturalModelLibrary` sont **non certifiants par défaut**, et examiner tous les chemins où un monument pourrait encore être rendu comme une forme schématique sans avertissement.
3. Auditer `applyArchitecturalMask()` et la relation `heritageRef` ↔ un/multiple IDs IGN ; éviter masquage de voisins, lacunes de sélection, réapparition d'extrusions, fuites GPU et éclipses lors des LOD.
4. Corriger les **documents contradictoires sur les numéros de version** et les déclarations de « toit non validé » devenues fausses ; conserver la distinction toit MNH vs façade vérifiée.
5. Auditer les reconstructions LiDAR : cohérence projection/altitude, trous, 98,26 % de couverture réellement rendu, variations hétérogènes du campanile, oscillation des normals, CPU/GPU lors de la création de grands batches.

## P1 — reconstruction réelle de l'Hôtel de Ville

1. Récupérer **effectivement** les dessins BHdV `CC64_PL34`, `CC16_pl39`, `CC76_PL04` et les planches IIIF Carnavalet. Vérifier les pages, licences, échelles, prises de mesures et appartenance au bâtiment construit.
2. Élaborer **un tableau de cotes vérifiables** : pour chaque aile et façade, système d'axes, hauteur de niveau, espacements de travées, profils des corniches et fenêtres ; aucune cellule estimée déclarée attestée.
3. Enregistrer un **calage EPSG:2154** + transformation local Babylon vérifiée sur plusieurs points. Repérer les résidus et comparer l'état des plans avec les données actuelles LiDAR/Paris Data.
4. Produire un **premier maillage détaillé d'une portion identifiée** (p. ex. une tourelle et une travée documentées) ; il doit être *réellement documenté*, visuellement inspectable, compatible avec le moteur et son picking. **Ne pas revendiquer immédiatement `fullReplacement` de l'Hôtel de Ville si seule une façade est validée.**
5. Étendre aux ailes et toitures **seulement quand elles sont mesurées** ; prévoir l'incrémental/partiel dans le moteur, avec une couverture certifiée par sous-ensemble (`partId`, footprint, surfaces, sourceIds), plutôt que le booléen `fullReplacement` actuel pour tout le bâtiment.
6. Préparer haute/moyenne/basse qualité **depuis le master** ; définir un seuil de LOD basé sur l'erreur projetée à l'écran + test du changement de caméra, plutôt que rayon seul.
7. Ajouter tests géométriques reproductibles, captures de comparaison de la même portion depuis plusieurs angles **avec les vrais documents**, inspection sur Android et rapport FPS.

## P2 — ouverture à tous les monuments et aux bâtiments ordinaires

1. Répliquer la chaîne de traitement et les schémas sur quelques typologies distinctes : monument métallique (tour Eiffel), religieux gothique (Notre-Dame), palais institutionnel (Sénat/Assemblée nationale), patrimoine culturel (Opéra / Louvre), immeuble plus ordinaire.
2. Associer les 55 candidats non matchés à **leurs vrais ensembles** et segmentation d'empreintes ; ne pas procéder par géocode approximatif pris pour une preuve.
3. Définir un processus de production à l'échelle des 195 entrées et, à terme, des autres bâtiments : assurance qualité documentaire par classe, niveaux de fidélité gradués et besoins de consultation sur place.
4. Préserver le jeu municipal, les sauvegardes, les 80 quartiers, les couleurs, les performances et la jouabilité à tous les zooms.

## Critère réel de passage à 0.27

Avoir produit **au moins un monument emblématique avec une reconstruction architecturale significative et traçable**, démontrée par des plans de construction interprétés, des dimensions chiffrées avec sources, un comparatif actuel, un master géométrique contrôlé, des LOD testés et le comportement mobile vérifié ; le propriétaire décidera ensuite si la fidélité est suffisante pour afficher 0.27. **Le seul fait de charger une toiture LiDAR ou une série de plans dans `dossiers.json` n'est pas un passage à 0.27.**

---

# 17. Critères de recette technique et documentaire proposés à Claude

A. **Preuves** : cote de chaque élément important liée à un document, numéro de plan, vue, date et précision ; aucun « exact » non documenté.  
B. **Géoréférencement** : cohérence EPSG:2154, hauteurs relatives/absolues explicitement séparées ; erreurs de calage mesurées et justifiées ; cours et trous correctement soustraits.  
C. **Architecture** : silhouette, décrochements, ailes, toiture, baies, travées et corniches représentés à la qualité autorisée par les plans ; sculptures seulement quand leurs géométries sources le permettent.  
D. **Comparaison** : tests de dimensions et vues indépendantes ; documents historiques et état actuel comparés, jamais confondus.  
E. **Conformité du moteur** : ne pas masquer le bâti avant chargement de la pièce qui le remplace, préservation du picking et des informations du monument, rollback immédiat si asset absent/corrompu, LOD sans trous ni téléportation.  
F. **Performance** : tests 360° et aller-retour avec FPS, draw calls, VRAM/heap, téléchargements et temps de réaction mesurés sur appareils réalistes, pas seulement PC.  
G. **Régression** : CI Python complète, audit de sources, tsc, npm run build, Web Pages, APK debug, sauvegardes, quartiers et décisions municipales.  
H. **Droits** : provenance/licence de chaque ressource, documents non redistribuables séparés, citations maintenues.  
I. **Honnêteté de version** : statut « documentation disponible », « coordonnées d'emprise », « toit LiDAR mesuré », « façade en cours », « modèle complet vérifié » affichés distinctement et concordants entre docs, build et écran.

**Ne pas définir par magie une tolérance universelle de 1 cm ou 5 cm** : elle dépend de la précision du document, du relevé, de sa date, de l'élément (ornement vs cour) et du système de mesure. Donner les résidus observés et le motif du seuil choisi.

---

# 18. Choses à NE PAS faire, même si elles rendraient une capture plus belle

- Remplacer le monument par un cube, un toit pyramidal ou des colonnes copiées arbitrairement en prétendant à l'exactitude.
- Déduire des cotes du bâtiment de la seule largeur/hauteur d'une feuille historique numérisée.
- Confondre dessin d'architecture, photographie, carte IGN, nuage LiDAR, modèle de silhouette et maquette certifiée.
- Utiliser l'IA générative d'image pour produire des façades servant de relevé métrique ; une image stylisée n'est pas une géométrie mesurée.
- Inventer des matériaux, fenêtres, statuts de propriétaire ou usages en inférant depuis le nom d'une rue.
- Déployer un modèle qui masque des triangles IGN avant d'avoir réussi à charger et vérifier leurs remplacements.
- Activer des textures satellite ou un cycle graphique jour/nuit visuel contraire à la validation utilisateur.
- Détériorer la caméra 360°, le mode Rue, la fluidité, les sauvegardes, les 80 quartiers, l'horloge ou le gameplay pour gagner des détails.
- Publier de nouvelles notes patrimoniales factuellement inventées juste pour satisfaire un test de version.
- Annoncer des tests Android ou un FPS mesuré si seuls des workflows GitHub ont réussi.
- Renommer 0.26.4 en 0.27 sans reconstruction mesurée validée, ni fabriquer artificiellement un `publicationAllowed:true`.

---

# 19. Références et liens vers le code / documents au SHA immuable

**Racine immuable pour cliquer les chemins de cette navette :**  
`https://github.com/meyameya677-sketch/Paris-le-jeu/blob/f1c018df788e6d0fc8ee6248d5f35e1e4cb11ed5/`

**Ordre de lecture recommandé à Claude :**

1. [`docs/ARCHITECTURE_FIDELITE.md`](https://github.com/meyameya677-sketch/Paris-le-jeu/blob/f1c018df788e6d0fc8ee6248d5f35e1e4cb11ed5/docs/ARCHITECTURE_FIDELITE.md) ; attention à des sections historiquement contradictoires sur la révision.
2. [`public/data/metropole/architecture/dossiers.json`](https://github.com/meyameya677-sketch/Paris-le-jeu/blob/f1c018df788e6d0fc8ee6248d5f35e1e4cb11ed5/public/data/metropole/architecture/dossiers.json).
3. [`public/data/metropole/architecture/survey-4e.json`](https://github.com/meyameya677-sketch/Paris-le-jeu/blob/f1c018df788e6d0fc8ee6248d5f35e1e4cb11ed5/public/data/metropole/architecture/survey-4e.json).
4. [`data/quality/lidar-4e-reconstruction.json`](https://github.com/meyameya677-sketch/Paris-le-jeu/blob/f1c018df788e6d0fc8ee6248d5f35e1e4cb11ed5/data/quality/lidar-4e-reconstruction.json).
5. [`src/buildings.ts`](https://github.com/meyameya677-sketch/Paris-le-jeu/blob/f1c018df788e6d0fc8ee6248d5f35e1e4cb11ed5/src/buildings.ts).
6. [`src/architectureModels.ts`](https://github.com/meyameya677-sketch/Paris-le-jeu/blob/f1c018df788e6d0fc8ee6248d5f35e1e4cb11ed5/src/architectureModels.ts).
7. [`src/architectureDossiers.ts`](https://github.com/meyameya677-sketch/Paris-le-jeu/blob/f1c018df788e6d0fc8ee6248d5f35e1e4cb11ed5/src/architectureDossiers.ts).
8. [`scripts/prepare_lidar_roofs_4e.py`](https://github.com/meyameya677-sketch/Paris-le-jeu/blob/f1c018df788e6d0fc8ee6248d5f35e1e4cb11ed5/scripts/prepare_lidar_roofs_4e.py).
9. [`scripts/prepare_architecture_survey_4e.py`](https://github.com/meyameya677-sketch/Paris-le-jeu/blob/f1c018df788e6d0fc8ee6248d5f35e1e4cb11ed5/scripts/prepare_architecture_survey_4e.py).
10. [`scripts/audit_architectural_models.py`](https://github.com/meyameya677-sketch/Paris-le-jeu/blob/f1c018df788e6d0fc8ee6248d5f35e1e4cb11ed5/scripts/audit_architectural_models.py).
11. [`src/main.ts`](https://github.com/meyameya677-sketch/Paris-le-jeu/blob/f1c018df788e6d0fc8ee6248d5f35e1e4cb11ed5/src/main.ts), `src/heritageAtlas.ts`, `src/metroTiles.ts`, `src/tileManager.ts`, `src/mobileCamera.ts`.
12. [`docs/INVENTAIRE_MONUMENTS.md`](https://github.com/meyameya677-sketch/Paris-le-jeu/blob/f1c018df788e6d0fc8ee6248d5f35e1e4cb11ed5/docs/INVENTAIRE_MONUMENTS.md), `docs/FACADES_PARIS.md`, `CREDITS_DONNEES.md`.
13. [Workflows Web, Android, LiDAR et validations](https://github.com/meyameya677-sketch/Paris-le-jeu/tree/f1c018df788e6d0fc8ee6248d5f35e1e4cb11ed5/.github/workflows).
14. [`tests/test_architecture_dossiers_026.py`](https://github.com/meyameya677-sketch/Paris-le-jeu/blob/f1c018df788e6d0fc8ee6248d5f35e1e4cb11ed5/tests/test_architecture_dossiers_026.py), `test_architecture_survey_026.py`, `test_lidar_mosaic_026.py`, `test_lidar_renderer.py`.
15. [Publication Web 0.26.4, succès](https://github.com/meyameya677-sketch/Paris-le-jeu/actions/runs/42638528424), [compilation APK n°68, succès](https://github.com/meyameya677-sketch/Paris-le-jeu/actions/runs/42638528328).

**PR historiques représentatifs à étudier** : [#2 inventaire des 195 monuments](https://github.com/meyameya677-sketch/Paris-le-jeu/pull/2), [#3 sources architecturales et LOD contrôlé](https://github.com/meyameya677-sketch/Paris-le-jeu/pull/3), [#4 relevés IGN du 4e](https://github.com/meyameya677-sketch/Paris-le-jeu/pull/4), [#5 diagnostic LiDAR](https://github.com/meyameya677-sketch/Paris-le-jeu/pull/5), [#6 mosaïquage LiDAR](https://github.com/meyameya677-sketch/Paris-le-jeu/pull/6), [#12 livraison 0.26.4](https://github.com/meyameya677-sketch/Paris-le-jeu/pull/12), [#13 réparation des tests de version](https://github.com/meyameya677-sketch/Paris-le-jeu/pull/13). Les PR entre #6 et #12 comportent d'autres améliorations du pipeline et de la mesure du campanile : **ne pas présumer que ce résumé reproduit l'intégralité de leurs diffs** ; lire le code final.

---

# 20. Instructions de retour à Claude : navette R02 et modifications

Le propriétaire souhaite faire **aller et retour entre ChatGPT et Claude**, et non obtenir un essai rhétorique. Merci de retourner un **fichier Markdown `NAVETTE_CLAUDE_PARIS_R02.md`**, avec les champs ci-dessous, accompagné des fichiers de code ou patchs si de nouvelles implémentations ont été réalisées. Les dates, chemins et SHA doivent être explicitement renseignés. Ne pas inventer de tests ni d'accès aux documents.

## En-tête obligatoire de R02

```yaml
navette: PARIS-LE-JEU
iteration: R02
base_sha: f1c018df788e6d0fc8ee6248d5f35e1e4cb11ed5
working_sha: null           # commit réel si Claude a modifié GitHub
new_pull_request: null      # URL réelle si une PR a été ouverte
version_reported: '0.26.4' # ne passer à 0.27 que si condition validée
scope: 'Reconstruction métrique monumentale / Hôtel de Ville'
source_documents_actually_opened: []
source_dimensions_actually_transcribed: 0
new_architectural_meshes_approved: 0
android_tested_on_physical_device: false
full_tests_executed: false
```

## Sections que Claude doit remplir sans supprimer l'historique R01

**R02-A — Audit contradictoire.** Pour chaque affirmation importante de R01, écrire : confirmé, corrigé avec preuve, ou non vérifiable ; marquer explicitement les erreurs de notre code et les risques inattendus.

**R02-B — Documents nouveaux réellement consultés.** Fournir cote officielle, URL pérenne, page/feuille, auteur, édition et licence. Séparer liste des feuilles retrouvées de liste des feuilles **lues** et effectivement exploitées.

**R02-C — Registre de mesures.** Pour chaque cote utile : élément, valeur, unité, échelle, emplacement dans la feuille, état historique/actuel, tolérance, source et recalage spatial. Les mesures inconnues ont `null`, pas une valeur inventée.

**R02-D — Programme/patch.** Liste complète des fichiers modifiés et ajouts, `git diff` ou PR vérifiée, SHA de base, schémas et chemin de migration, informations pour intégrer les véritables meshes sans casser Babylon/gestes/sauvegardes.

**R02-E — Essais/CI.** Commandes effectivement lancées, sortie des tests (pass/échec), compilation Web, compilation Android, vérification de géométrie, bilan performance et FPS seulement si réellement mesurés.

**R02-F — Fidélité effective atteinte.** Tableau par élément de monument : *source trouvée*, *cote vérifiée*, *géométrie mesurée*, *modèle dans le moteur*, *LOD contrôlé*, *visuel testable*, *incertitudes* ; différencier minimum culturel plausible et géométrie fidèle.

**R02-G — Priorités pour ChatGPT.** Liste hiérarchisée des prochaines tâches, changements potentiellement destructifs, questions de source/lisibilité nécessitant intervention humaine, et état explicite du verrou 0.27.

Si Claude peut ouvrir une branche publique du dépôt avec autorisation du propriétaire, la nommer par exemple `feat/claude-hotel-de-ville-measured`, fournir une PR et ne jamais merger silencieusement. S'il ne peut pas écrire sur GitHub : renvoyer un ZIP de fichiers modifiés et/ou patch `git diff` complet, pas seulement une description ; la navette doit citer chaque pièce et commande de test. S'il n'arrive pas à lire les IIIF/ARK en ligne, le signaler et **demander les documents manquants au propriétaire sans inventer leurs dimensions**.

---

# 21. Décision finale au moment du transfert

**Ce qui est réellement acquis :** version 0.26.4 Web et APK de test compilés, base du jeu, 80 quartiers, catalogue 195 monuments, quatre couleurs et parcours UI, 2 696 bâtiments du 4e, 287 075 bâtiments référencés au grand périmètre, 1 748 toitures MNH validées, première toiture de l'Hôtel de Ville reconstruite depuis deux dalles LiDAR à 0,5 m et représentée par 3 490 triangles ; sources historiques d'exécution majeures identifiées et associées à un dossier documentaire, contrôles de publication et LOD préparés.

**Ce qui reste totalement déterminant :** **AUCUNE façade monumentale « trait pour trait » reconstruite et certifiée, AUCUN ensemble complet de colonnes/sculptures/baies/corniches réellement coté, AUCUNE maquette monumentale complète dans `models/index.json`, AUCUN essai Android physique validant le résultat, AUCUNE autorisation d'étiqueter l'ensemble 0.27.** C'est à Claude d'aider à franchir ce verrou par des **données sources effectivement interprétées et des fichiers géométriques concrets**, non par une déclaration de principe ou une image de démonstration.

**Fin R01 — espace réservé au retour R02 de Claude AI.**
