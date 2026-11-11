# R11 — Architecture réelle multi-vues et monochromie patrimoniale

**Décision du propriétaire — 11 novembre 2026.** Cette directive affine le
chantier PARIS Matières et remplace toute interprétation voulant
« photoréaliser » les monuments par des façades et couleurs arbitraires.
Elle conserve intégralement les résultats R09 (inventaire historique),
M0/J1 (unités, GeoPackage, cache LiDAR) et les verrous de publication.

## 1. Règle visuelle absolue : monuments en BEIGE, une seule teinte

- **Teinte unique : `#DED0B9` (RGB 222, 208, 185)** pour les monuments
  dont l'identité patrimoniale est **effectivement vérifiée et rattachée**
  à une géométrie. Ne pas distinguer politiques, culturels, religieux,
  économiques, mineurs/majeurs, par des couleurs différentes.
- **Murs, toiture, détails, encadrements, corniches, tours et éléments
  architecturaux portent cette même teinte de matériau** : le relief
  ressort seulement par la lumière et les ombres, pas par des textures
  photographiques ou une autre palette.
- Cette règle s'applique en mode Maquette, mode Réaliste expérimental,
  vue Rue, scène proche, LOD lointain, panorama, légendes et repères.
  Les surfaces non patrimoniales conservent la maquette blanc/gris ;
  les revêtements de sols, eaux et végétations peuvent être travaillés
  dans un mode distinct sans modifier la couleur des monuments.
- **Une notice POP n'est pas une preuve de géométrie**. Les 2 057 notices
  vérifiées incluent différents types de patrimoine ; elles ne qualifient
  pas automatiquement chaque bâtiment voisin de monument. Colorer le
  bâtiment uniquement quand l'appariement notice ↔ emprise est fiable.
  Lorsqu'un monument est certain mais son emprise est inconnue, afficher
  uniquement une notice/repère beige, sans recolorer un bâtiment proche.
- Le moteur ne doit pas texturer un monument d'une façade rouge/grise/
  photographique lorsque des images ouvertes seront disponibles.
  Ces images servent à **mesurer les segments**, pas à repeindre le
  monument. Le modèle n'est pas moins authentique parce qu'il est beige.

## 2. Objectif réel : géométrie d'architecture, pas extrusion améliorée

Reproduire, dans les limites des sources disponibles, les SEGMENTS
attestés : contour réel des toitures, faîtages, croupes, lucarnes, tours,
flèches, travées, corniches, ouvertures, arcs, balcons, contreforts,
baies, colonnes, variations de profondeur et silhouettes d'éléments
significatifs. Distinction entre :
`mesure-3D` (triangulation/points contrôlés),
`mesure-plan` (cote de dessin/élévation vérifiable),
`inference-geometrique` (solution plausible, non certifiée),
`inconnu` (aucun détail généré).
Les **segments attestés** prennent le pas sur les volumes IGN dans la
géométrie visible, sans perdre l'ancrage métrique ni la liaison
identifiant IGN/POP, et sans inventer d'éléments cachés.

L'IGN n'est plus la source de détail architecturale dominante :
il reste la **référence spatiale**, le contrôle d'emprises et de hauteurs,
les nuages de points de toits et reliefs, les fonds aériens.
La photographie verticale n'observe pas les façades cachées ; un pixel
de satellite ne crée pas une fenêtre ou une statue absente des données.

## 3. Hiérarchie des sources photographiques et documentaires

**À interroger par bâtiment, avec licence par fichier et date de prise
de vue** :

1. **Images multi-vues de rue ouvertes : Panoramax** (API STAC/OGC,
   vues géolocalisées, orientation/EXIF à vérifier ; licences variables
   selon l'instance et la photographie) :
   https://docs.panoramax.fr/how-to-contribute/use-panoramax/
2. **Wikimedia Commons** (plusieurs angles et détails d'architecture,
   fichiers à licences explicites, attribution/ShareAlike selon fichier) :
   https://commons.wikimedia.org/
3. **Paris Musées** : images effectivement marquées CC0, en particulier
   plans/croquis et vues, jamais supposer que toutes les images sont CC0 :
   https://parismuseescollections.paris.fr/
4. **Archives de Paris** : plans d'édifices, coupes, élévations ;
   conditions de réutilisation et état historique à vérifier séparément :
   https://archives.paris.fr/archives-numerisees/plans/cartes-geographiques-et-plans-dedifices/plansdedifices
5. **Gallica/BnF** pour plans, cotes et vues historiques ;
   l'accès gratuit ne signifie pas réutilisation commerciale gratuite :
   https://www.bnf.fr/fr/portail-bnf-api-et-jeux-de-donnees
6. **Photos aériennes originales ouvertes, si multi-vues et droits
   réellement vérifiés**, y compris la photothèque de prises de vues
   aériennes historiques IGN ; BD ORTHO verticale pour toits/contrôles,
   pas pour déduire les façades :
   https://www.data.gouv.fr/datasets/prises-de-vue-aeriennes-dematerialisees-de-lign

**Refus catégorique** : aucune extraction Google Earth, Street View,
Apple Maps, Bing ou données satellites commerciales sous conditions
fermées ; pas de donnée DINAMIS/Pleiades limitée à un usage institutionnel
sans droit explicite de redistribution dans notre jeu. Pas d'images
générées par IA présentées comme photographie de mesure.

## 4. Chaîne libre retenue pour la restitution au segment

`détection corpus photos et licences → images vérifiées → calibration
intrinsèque/extrinsèque → COLMAP/AliceVision Meshroom (SfM/MVS) → nuage
dense, mesh et segments → contrôle avec plans et LiDAR → géoréférencement
EPSG:2154/NGF → modélisation sémantique → GLB/LOD → réception`.

- **COLMAP** (https://colmap.github.io/) et/ou **AliceVision/Meshroom**
  (https://alicevision.org/) : photogrammétrie libre réelle.
- La triangulation exige des **vues avec recouvrement et parallaxe**,
  une identité certaine du bâtiment, des photos non contradictoires et
  un nombre de vues suffisant ; une seule photo isolée ne permet pas
  une reconstruction 3D attestée.
- **Aucune substitution de temps historiques** : distinguer une photo
  de 1900 d'une façade de 2026 ; plans anciens sont des documents,
  pas une mesure automatiquement vraie du bâtiment actuel.
- **LiDAR HD et Roofer** restent des **sous-étapes utiles** pour
  toits/altitudes. Ils ne suffisent pas à reconstruire les sculptures,
  fenêtres, pierres ou la segmentation précise des façades.
- Pour chaque segment, enregistrer `type`, source(s), preuve,
  référentiel, précision ou incertitude, et `etat`.
- Si les images publiques sont trop rares ou non multi-vues :
  maquette géométrique attestée disponible et **aucune façade
  procédurale assimilée à un relevé**.

## 5. Premier pilote de validation

Notre-Dame : `bat:BATIMENT0000000305564422`, POP
`PA00086250` ; Hôtel de Ville : POP `PA00086319` en second.
Garder intact le travail de transmission et son protocole d'unités.

Avant de générer : dresser, sans aspiration massive, un manifeste
d'images/licences/orientations pour Notre-Dame, avec répartition par
façade et date. Indiquer où les vues sont absentes. Acquérir d'abord
les *images ouvertes réutilisables* permettant une triangulation réelle,
puis poursuivre le calage LiDAR/IGN comme contrôle.
Livrer un **premier segment réellement attesté**, et comparer le
maillage reconstruit au même emplacement sur la maquette géographique.

**Preuves d'acceptation** : sources identifiées, conformité des droits,
position de chaque segment avec incertitude et état, apparence beige
unique, vrai test de géométrie et capture de la branche correspondante.
Le RMS LiDAR doit être **calculé**, non déduit du seul titre du fichier ;
un RMS de toiture ne certifie pas une façade.
Si la qualité des images ne permet pas la reconstruction, produire
un état `documenté-mais-non-reconstruit` sans générer de faux détail.

## 6. Livraison et verrou

Travaux sur PR #14, branche existante ; CI sur HEAD et bilan `fait /
partiel / bloqué`. Ne pas fusionner, publier, modifier `main`, ni
annoncer 0.27 sans accord explicite du propriétaire. Le lien du jeu
public doit figurer à la fin de chaque livraison, en précisant que
la PR n'y est pas encore visible.

**Jeu public :** https://meyameya677-sketch.github.io/Paris-le-jeu/
