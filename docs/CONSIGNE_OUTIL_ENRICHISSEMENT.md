# Consigne technique — outil d'enrichissement graphique des unités PARIS

Destinataire : l'outil (logiciel, agent ou chaîne de traitement) chargé de transformer
chaque unité de base du jeu PARIS en unité réaliste, digne d'une navigation 3D
satellitaire, **sans recourir à Google Earth ni à aucune source fermée**.

Documents liés : `docs/UNITES_EXPORT.md` (contrat d'échange), `schemas/unite-v1.schema.json`,
`scripts/export_units.py` (production des unités), `scripts/check_unit_return.py` (réception).

---

## 0. Règles non négociables

1. **Vérité avant beauté.** Toute géométrie et toute couleur doivent venir d'une mesure ouverte
   (LiDAR, orthophoto, base officielle). Ce qui est déduit ou procédural est **déclaré** comme tel
   dans le rapport ; ce qui est inconnu n'est pas inventé.
2. **Sources autorisées seulement** (§2). Interdits : Google Earth / Maps / Street View, Apple Plans,
   Bing / Virtual Earth, Here, imagerie satellite commerciale, et tout contenu sans licence explicite.
   Une seule source interdite suffit à faire refuser l'unité.
3. **Le géoréférencement est sacré.** Même `id`, même `versionBase`, même `ancre`. Les sommets sont
   exprimés dans le repère local de l'unité (X est, Y haut, Z sud, mètres, origine = ancre
   EPSG:2154 + NGF-IGN69). Aucune rotation ni matrice de nœud : transformations appliquées aux sommets.
4. **Le mode maquette du jeu doit survivre.** Le jeu conserve un rendu blanc/gris sans texture où
   seuls les monuments majeurs sont beiges. La géométrie enrichie doit donc rester lisible sans
   texture (§6.4).
5. **Une unité = un travail atomique, reproductible et traçable.** Même entrée + mêmes sources
   = même sortie (graines aléatoires fixées, versions d'outils consignées).
6. **Politesse envers les serveurs publics** (§2.3) : cache local, débit limité, aucun aspirateur massif.

---

## 1. Découverte des unités et file de travail

L'outil détecte lui-même ce qu'il doit traiter :

1. Lire `export/unites/catalogue.json` (`colonnes` : `id`, `tuileJeu`, `x`, `z`, `versionBase` ;
   `batiments` ; `sols`). S'il est absent, lancer `python scripts/export_units.py --catalogue`.
2. Une unité est **à traiter** si aucun retour accepté n'existe dans `retours/<type>/<id>/`
   avec la **même** `versionBase`. Si la version a changé (mise à jour IGN), le retour existant
   est périmé : retraiter.
3. Matérialiser l'unité de base à la demande :
   `python scripts/export_units.py --bat BATIMENT…` ou `--sol=ix_iz` ou `--zone lon,lat,rayon`.
4. **Ordre de priorité** :
   1. les 140 monuments majeurs (`attributs.patrimoine[].majeur = true`) et leurs dalles de sol ;
   2. le 4e arrondissement (données les plus riches : toits LiDAR, matériaux) ;
   3. les arrondissements 1 à 20, du centre vers la périphérie, **par îlots entiers**
      (une dalle de sol + tous ses `batiments`), pour que les quartiers s'améliorent d'un bloc ;
   4. les 29 communes limitrophes.
5. Traiter les bâtiments d'une dalle **après** la dalle de sol (le sol fixe l'altitude du pied des murs).
6. Après chaque unité : `python scripts/check_unit_return.py retours/<type>/<id>`. Un refus est
   journalisé avec sa cause, l'unité reste à traiter ; jamais de contournement du contrôle.

---

## 2. Sources gratuites

### 2.1 Fournies dans chaque unité (`sourcesGratuites`)

| Source | Usage principal | Résolution | Licence |
|---|---|---|---|
| IGN LiDAR HD, nuage classé COPC (`url_npl` via l'index WFS) | géométrie des toits, hauteurs exactes, végétation, sol | ~10 pts/m² | Licence Ouverte 2.0 |
| IGN LiDAR HD MNT / MNS / MNH | relief du sol, surface des toits, hauteur au-dessus du sol | 50 cm | Licence Ouverte 2.0 |
| IGN BD ORTHO | texture des toits et du sol | 20 cm | Licence Ouverte 2.0 |
| IGN ORTHO IRC | séparation végétal / minéral (NDVI) | 20 cm | Licence Ouverte 2.0 |
| IGN BD TOPO bâtiments | altitudes sol/toit, nombre d'étages, usage, matériaux | vecteur | Licence Ouverte 2.0 |
| Copernicus Sentinel-2 | teinte saisonnière, contrôle colorimétrique | 10 m | libre et gratuit |

### 2.2 Sources ouvertes complémentaires recommandées

| Source | Usage | Licence |
|---|---|---|
| BDNB (Base de données nationale des bâtiments, CSTB) | année de construction, matériaux des murs et des toits | Licence Ouverte 2.0 |
| APUR — open data (hauteurs, périodes de construction à Paris) | typologie des façades par époque | ODbL |
| Panoramax (imagerie de rue géolocalisée, communs IGN/OSM France) | couleurs et rythmes de façades vus de la rue | licence indiquée photo par photo (CC-BY-SA, Licence Ouverte…) |
| OpenStreetMap (`building:levels`, `roof:shape`, `building:material`) | contrôle croisé, jamais seule source de géométrie | ODbL |
| Mérimée / POP (ministère de la Culture) | description des monuments protégés | Licence Ouverte 2.0 |
| Paris Data (voirie, trottoirs, mobilier, arbres) | revêtements, bordures, arbres | ODbL |

Toute source utilisée est déclarée dans `enrichissement.sources` avec `id`, `url`, `licence`,
`dateAcquisition`. Attribution exigée par la licence : `rapport-qualite.json` → `attributions`.

### 2.3 Accès réseau

- Cache local par dalle LiDAR de 1 km (`LHD_FXX_EEEE_NNNN`) : une dalle sert à des centaines d'unités.
- Au plus 4 requêtes simultanées par serveur IGN, reprise exponentielle sur 429/5xx, `User-Agent` explicite.
- Ne télécharger que l'emprise utile (+ 5 m) quand le service le permet (WMS cadré déjà fourni).

---

## 3. Chaîne de traitement — unités `sol`

Entrée : `unite.json` (relief 21 × 21 approximatif, surfaces, arbres, liste des bâtiments).

1. **Relief** : remplacer la grille par le MNT LiDAR HD 50 cm découpé à la dalle (200 m → 401 × 401).
   Simplifier par maillage adaptatif (erreur verticale ≤ 5 cm en LOD0).
2. **Coutures entre dalles** (impératif) : les sommets des quatre bords sont **imposés** sur la grille
   régulière de 50 cm, avec les mêmes altitudes que la dalle voisine (même MNT, même échantillonnage).
   Aucune fissure, aucun décalage au raccord : deux dalles voisines produisent des bords identiques au bit près.
3. **Emprises des bâtiments** : sous chaque bâtiment, le sol est conservé (pas de trou) ; le bâtiment
   descend dessous (§4.6).
4. **Texture du sol** : BD ORTHO 20 cm, découpée à la dalle, avec :
   - masquage des bâtiments (emprises IGN dilatées de 0,5 m) puis remplissage par la texture de voirie ;
   - correction du dévers : les toits hauts « débordent » sur la rue dans l'orthophoto classique ;
     les reprojeter à partir du MNS (vraie ortho locale) ;
   - atténuation des ombres portées (égalisation locale guidée par le MNS et l'heure de prise de vue).
5. **Matériaux PBR par classe de surface** (chaussée, trottoir, eau, pelouse, terre, pavé, gravier) :
   classes issues des couches Paris Data, de la classification LiDAR et du NDVI de l'IRC.
   Un matériau = albedo (orthophoto) + rugosité et normale (bibliothèque libre CC0, ex. ambientCG,
   Poly Haven) ; l'albedo vient de la photo, jamais d'une couleur inventée.
6. **Eau** : surface plane à l'altitude mesurée du plan d'eau (LiDAR, classe 9), matériau eau.
7. **Végétation** :
   - arbres municipaux : position de `arbres.elements`, hauteur et diamètre de houppier mesurés sur le MNH ;
     maillage d'arbre instanciable (3 modèles par genre au plus) ;
   - autres masses végétales : points LiDAR classes 3 à 5 regroupés en houppiers ; déclarés « détectés ».
8. **Détails urbains** (optionnels, s'ils sont mesurés) : bordures de trottoir (MNT), quais, escaliers.

---

## 4. Chaîne de traitement — unités `batiment`

Entrée : `unite.json` (emprise IGN en EPSG:2154, hauteur, usage, altitude du sol, patrimoine,
compléments 4e), `base.glb` (extrusion plate).

1. **Points du bâtiment** : extraire du nuage LiDAR HD les points de classe 6 (bâtiment) dans l'emprise
   dilatée de 1 m, et les points de sol (classe 2) dans une couronne de 3 m.
2. **Pied des murs** : altitude du sol = médiane des points de sol de la couronne (pas la grille 200 m).
3. **Toiture (niveau LoD2 CityGML)** :
   - segmentation en pans par croissance de régions ou RANSAC (seuils : normale 10°, distance 15 cm) ;
   - intersection des pans pour obtenir faîtages, noues et arêtiers nets ;
   - reconnaissance des formes typiques parisiennes : **toit à la Mansart** (brisis à ~70°,
     terrasson à ~15°), terrasse, deux pans, pavillon, verrière ;
   - superstructures mesurables : souches de cheminée, lucarnes, édicules, verrières
     (taille minimale 0,8 m, sinon ignorer) ;
   - si moins de 4 points/m² ou ajustement mauvais (RMS > 0,3 m) : toit plat à la hauteur mesurée,
     déclaré `toit: "plat-repli"`.
4. **Murs** : extrudés depuis l'emprise IGN, qui fait foi (ne pas la remplacer par le contour LiDAR).
   Lisser les sommets presque alignés (< 0,2 m) ; conserver les cours intérieures.
5. **Façades** (le cœur du réalisme vu de la rue) :
   - typologie par époque (BDNB, APUR) et par usage : haussmannien (R+5 à R+7, étage noble au 2e,
     balcons filants aux 2e et 5e, combles mansardés), faubourien, immeuble de rapport, années 1930,
     après-guerre, contemporain, monument (§5) ;
   - rythme mesuré quand c'est possible : nombre d'étages (BD TOPO, BDNB), largeur des travées
     déduite des photos Panoramax ; sinon grammaire procédurale de l'époque, **déclarée procédurale** ;
   - géométrie en relief, pas seulement en texture : fenêtres en retrait de 15 à 25 cm, bandeaux,
     corniches, balcons en saillie (LOD0 et LOD1 seulement) ;
   - couleur : pierre de taille, enduit, brique selon les matériaux BDNB/BD TOPO ; teinte calibrée
     sur l'orthophoto et Panoramax ; aucune enseigne ni publicité.
   - Mitoyenneté : aucune façade détaillée sur un mur mitoyen. Mur aveugle (pignon) si contigu
     à une autre emprise IGN ; détecter les contacts avec les emprises des bâtiments voisins.
6. **Raccord au sol** : prolonger les murs de 1 m sous l'altitude du sol mesurée (jupe) pour
   qu'aucun bâtiment ne flotte au-dessus d'une dalle de sol, quelle que soit la différence de
   précision entre les deux relevés.
7. **Texture de toit** : BD ORTHO 20 cm reprojetée sur les pans avec le MNS (vraie ortho),
   ombres atténuées ; zinc, ardoise, tuile, terrasse identifiés pour la rugosité et la normale.
8. **Compléments du 4e** (`attributs.complementsSources`) : `toitLidarHD` est déjà une mesure ;
   s'en servir comme référence de contrôle, pas comme vérité absolue face au nuage complet.

---

## 5. Monuments (140 majeurs et autres notices protégées)

- Repère : `attributs.patrimoine[]` (référence POP, lien vers la notice, `majeur`).
- Exigence plus forte : LOD0 jusqu'à 300 000 triangles, éléments caractéristiques mesurés au LiDAR
  (flèches, dômes, tours, contreforts, galeries).
- Sources descriptives : notice POP (dates, auteurs, description), plans et relevés publiés sous
  licence ouverte. Aucune maquette tierce sous licence fermée.
- Ne jamais « restaurer » un état historique : modéliser l'état actuel mesuré
  (ex. Notre-Dame : flèche reconstruite, mesurée dans le LiDAR le plus récent).
- Mode maquette : matériau `maquette-majeur` beige (§6.4).

---

## 6. Format de sortie

### 6.1 Dossier de retour

```
retours/<bat|sol>/<identifiant>/
  unite.json            même unité, etat "enrichie", bloc "enrichissement" rempli
  enrichi.glb           LOD0, détail maximal
  lod1.glb lod2.glb     niveaux réduits (bâtiments et sols)
  rapport-qualite.json  mesures, déclarations, attributions (§7)
  apercu.png            vue 3/4 à 1024 × 768, éclairage neutre
```

### 6.2 glTF

- glTF 2.0 binaire, textures **incorporées**, PBR métal/rugosité, unités en mètres.
- Compression autorisée et recommandée : `EXT_meshopt_compression` (géométrie),
  `KHR_texture_basisu` (KTX2, textures). Déclarer les extensions dans `extensionsRequired`.
- Accesseurs `POSITION` avec `min`/`max` ; normales fournies ; tangentes si carte de normales.
- Faces orientées vers l'extérieur, sens trigonométrique vu de l'extérieur (règle glTF).
- Nommer les nœuds : `toit`, `murs`, `facade-<n>`, `superstructures`, `sol`, `eau`, `vegetation`.
- `extras` du nœud racine : `{"unite": id, "versionBase": …, "lod": n}`.

### 6.3 Budgets par unité (mobile d'abord)

| Unité | LOD | Distance de bascule | Triangles max | Texture max | Poids max |
|---|---|---|---|---|---|
| Bâtiment courant | LOD0 | < 150 m | 20 000 | 2048² | 8 Mo |
| | LOD1 | < 600 m | 3 000 | 512² | 1 Mo |
| | LOD2 | au-delà | 300 | 128² | 150 ko |
| Monument majeur | LOD0 | < 300 m | 300 000 | 4096² | 8 Mo (compressé) |
| Dalle de sol | LOD0 | < 300 m | 120 000 | 4096² | 16 Mo |
| | LOD1 | < 1 500 m | 15 000 | 1024² | 2 Mo |
| | LOD2 | au-delà | 1 500 | 256² | 200 ko |

Densité de texture cible : 5 à 10 cm par texel en LOD0 (sous la résolution de l'orthophoto,
on ne fabrique pas de détail photographique : on passe au procédural déclaré).

### 6.4 Compatibilité avec le mode maquette

- La géométrie doit rester lisible sans texture : reliefs de façade réellement modélisés en LOD0.
- Chaque fichier inclut, en plus des matériaux texturés, deux matériaux non utilisés par défaut,
  `maquette-neutre` (blanc/gris) et `maquette-majeur` (beige `#DED0B9`), que le jeu peut appliquer
  à tous les nœuds pour retrouver le rendu maquette.
- La teinte attendue de l'unité est indiquée dans `attributs.teinte` (`neutre` ou `beige-majeur`).

---

## 7. Rapport de qualité (`rapport-qualite.json`)

```json
{
  "unite": "bat:BATIMENT0000000305564422",
  "versionBase": "sha256:…",
  "mesures": {
    "ecartLidarRmsM": 0.18,
    "ecartLidarMaxM": 0.9,
    "densitePointsParM2": 14.2,
    "couvertureTexturePct": 97,
    "triangles": {"lod0": 18412, "lod1": 2950, "lod2": 288}
  },
  "declarations": {
    "toit": "mesure-lidar",
    "facades": "procedural-epoque-haussmannienne",
    "couleurFacades": "panoramax+orthophoto",
    "elementsInventes": []
  },
  "attributions": ["© IGN — LiDAR HD, BD ORTHO, Licence Ouverte 2.0"],
  "outil": {"nom": "…", "version": "…", "graine": 42}
}
```

Seuils d'acceptation :
- bâtiment : écart RMS au nuage LiDAR (classe 6) ≤ 0,30 m, maximum ≤ 1,5 m hors superstructures ;
- sol : écart RMS au MNT ≤ 0,10 m ; bords identiques aux dalles voisines déjà acceptées ;
- `elementsInventes` doit rester vide : une hypothèse se déclare dans `declarations`, elle ne s'invente pas.

---

## 8. Contrôle à la réception

`scripts/check_unit_return.py` refuse l'unité si :
version de base ou ancre différente ; glTF invalide ; maquette hors emprise (3 m) ou enterrée
de plus de 15 m ; source interdite ou licence non autorisée ; budget de poids dépassé ;
LOD déclaré absent ou invalide ; rapport de qualité absent ou incomplet.
Il avertit si la hauteur dépasse nettement la hauteur IGN.

Le contrôle complémentaire (écart au LiDAR, coutures entre dalles) est recalculé côté jeu
avant l'intégration au rendu, par lots.

---

## 9. Ce que l'outil ne doit pas faire

- Recopier ou décalquer des données de Google Earth, Street View, Apple, Bing ou de toute maquette commerciale.
- Modifier une emprise IGN, une ancre ou un identifiant.
- Fusionner plusieurs unités en un seul fichier (sauf l'instanciation d'arbres et de mobilier dans une dalle de sol).
- Ajouter enseignes, publicités, véhicules, personnes ou détails non mesurés présentés comme réels.
- Embellir un monument au-delà de son état actuel mesuré.
