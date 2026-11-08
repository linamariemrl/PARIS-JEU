# PARIS — état de référence et ordre des travaux

**Version en développement : 0.26.0.** Nom visible : **Prototype 0.26**.
**Statut : 0.26 engagée après accord explicite le 8 novembre 2026 ; recette Android encore ouverte.**
Les critères graphiques, patrimoniaux et de performances restent à contrôler.

## Détails de jardins patrimoniaux (0.26)

- Le jardin du Luxembourg et les Tuileries sont des domaines cliquables sur
  leurs contours vectoriels OSM documentés, indépendants des volumes IGN.
- Les fiches recoupent les informations du Sénat, du Louvre et les notices
  culturelles POP/Mérimée. Les boisements, pelouses, massifs, bassins, allées
  et arbres additionnels ne sont tracés que lorsqu'une géométrie OSM réelle
  existe dans le périmètre reconnu. Sans géométrie, aucune plantation n'est
  imaginée.
- Les lignes d'allées n'ont pas de largeur ni de revêtement inventés.
  Les arbres sans hauteur recensée utilisent une hauteur de représentation
  explicitement schématique ; leur position est issue des données OSM.
- Les surfaces officielles existantes et la navigation restent prioritaires ;
  les nouveaux maillages sont groupés et permanents, sans réallocation à
  chaque déplacement ou changement de focale.
- Les notices protégées et les objets touristiques vectorisés ne sont pas
  une liste exhaustive de tous les sites touristiques. Toute attribution
  foncière ou patrimoniale reste conditionnée à la provenance de sa source.

## 1. Source unique et livrables

- **Code et historique :** dépôt `meyameya677-sketch/Paris-le-jeu`, branche `main`.
- **Jeu web et PWA :** https://meyameya677-sketch.github.io/Paris-le-jeu/
- **APK Android de test :** workflow `.github/workflows/android-apk.yml`,
  artefact `PARIS-Android-0_25-debug-<numéro du build>` associé au commit.
- **Parties :** base IndexedDB locale, schéma 1 compatible, sauvegarde
  automatique et archives JSON. La PWA et l'APK **ne partagent pas**
  automatiquement leurs données. Exporter/importer pour migrer.
- **Révision exacte :** `package.json` et `src/release.ts` doivent
  concorder. Le panneau Détails indique la révision du moteur.

## 2. Invariants à protéger

- Maquette blanche/grise, sans satellite, ni textures photoréalistes imposées,
  ni cycle jour/nuit visuel ; conserver horloge, commandes tactiles et 360°.
- Bâtiments d'après les sources IGN : emprises exactes et relief de toiture
  documenté **à proximité** ; rendu léger mais continu **au loin**.
  L'atlas distant de 50 m est une AGRÉGATION, non 287 075 empreintes
  individuelles visibles. Ne pas présenter le total indexé comme le
  nombre de maillages 3D simultanément affichés.
- Relief IGN, routes, ponts, eau et végétation officielle utilisent un
  référentiel spatial unique et respectent les dénivelés.
- Pas de triangles géants, de surfaces qui clignotent, de bâtiments
  flottants ou d'effacement brutal d'un quartier.
- Gestion municipale, dossiers, temps simulé, sauvegarde et export/import
  doivent survivre à chaque modification graphique.
- L'amélioration d'un quartier ne doit pas dégrader arbitrairement la
  qualité des autres : mêmes règles de LOD, même palette, mêmes priorités.

## 3. Ordre de stabilisation de la branche 0.26

1. **Intégrité géographique :** valider les inventaires IGN/PVP/Ville de
   Paris, les coordonnées, la couverture des secteurs et les frontières.
2. **Zéro artefact :** réviser le maillage des emprises en pente, la
   triangulation des routes/eaux, les ponts et les intersections.
3. **Continuité du LOD :** transition sans superpositions entre atlas
   agrégé / toitures simplifiées / volumes officiels exacts ; pas de
   zones vides au changement de focale.
4. **Fluidité Android :** conserver le mouvement tactile réactif, le
   cache de proximité et le budget GPU ; comparer les profils de zoom
   sur le même appareil, à chaud et après démarrage.
5. **Relief et détails :** renforcer simultanément la lecture des
   collines, du sol, des parcs, des arbres, des quais et des bâtiments,
   sans détérioration géométrique ni perte de performance.
6. **Parties durables :** rétablir heure, finances, dossiers ET caméra
   avec des fichiers JSON anciens et nouveaux ; vérifier PWA et APK.
7. **Livraison propre :** tests automatiques + essai réel sur Android
   + vérification des fichiers de distribution datés du bon commit.

## 4. Réception de la version 0.26 sur Android (contrôles obligatoires)

Voir `docs/RECETTE_ANDROID.md`. Les CI verts ne prouvent ni le rendu
WebGL ni la fluidité réelle sur un mobile. La validation finale de la 0.26 nécessite : zéro artefact majeur, couverture continue,
comportement stable du relief et de l'eau, végétation visible, navigation
fluide, absence de régression des fonctions du jeu, et sauvegardes
restaurées après fermeture et import/export.

## 5. Correctif réseau conservé en 0.26

- L'atlas IGN abandonne proprement ses maillages incomplets et relance
  jusqu'à trois chargements espacés ; une reconnexion relance le processus.
- Le cache CPU des bâtiments éloignés reprend son préchargement au retour
  du réseau. Le nombre de maillages GPU n'augmente pas pour ce motif.
- Le panneau d'installation indique en ligne/hors ligne, sans prétendre
  vérifier chaque serveur ni synchroniser les sauvegardes entre appareils.
- La version 0.26 est engagée ; ses évolutions restent à confirmer
  jusqu'à la recette visuelle Android.

## 6. Réserves documentées

- Le relief RGE ALTI à 200 m interpole les pentes ; il ne restitue pas
  tous les talus ou bordures de trottoirs.
- Les arbres sont aux emplacements recensés mais leur forme et certaines
  hauteurs sont schématisées.
- La Seine est basée sur les emprises IGN ; les hauteurs de sa surface
  ne sont pas un levé hydrologique.
- L'APK est un **debug Capacitor**, pas encore signé pour distribution
  générale ni testé sur tous les modèles Android.
- Les téléchargements instantanés ne peuvent pas être garantis sur un
  réseau mobile lent ou hors ligne ; le cache doit amortir ces attentes.

**Changement de règle :** toute évolution doit être adossée à un test
de non-régression, puis à une recette Android avant promotion.

## Enrichissement du patrimoine à chaque version

L'ajout de nouvelles fiches touristiques sourcées est obligatoire à chaque
nouvelle révision. Le registre `data/heritage-release.json` doit reprendre
le numéro de version et indiquer les références officielles nouvellement
traitées. Le test `scripts/audit_heritage_releases.py` bloque toute
révision dépourvue d'ajout réel ou qui régresse sur les notices POP.
Le rattachement à une emprise IGN ne se déduit jamais d'une simple proximité.
Les interactions de gestion sur bâtiments sont expressément reportées.

## Changement de priorité : stabilisation puis mécanismes de jeu

La cible photogrammétrique n'est plus une obligation de production.
Sur le moteur actuel, privilégier un rendu propre, continu et fluide ;
les améliorations architecturales sont bornées par les sources mesurées.
La suite du projet doit se concentrer sur la profondeur du jeu :
gestion municipale, décisions, événements, calendrier, arbitrages et
progression, sans exiger au préalable un rendu Google Earth.

Contrôles ajoutés pendant cette phase :
- publication web et compilation Android vérifiées par CI ;
- chargement de la nomenclature des rues par API paginée, la grosse
  exportation dépassant 80 Mo et aboutissant à un atlas manquant ;
- indexation des rues par paquets entre frames pour préserver les gestes ;
- conservation des chaussées proches durant les déplacements, puis
  libération des morceaux inutiles lorsque la caméra s'immobilise.

Le chiffre des FPS et le rendu Android doivent toujours être validés
sur un appareil réel ; aucune promesse de performances non mesurées.

## Hôtel de Ville — première tranche jouable (0.26.3)

- Catalogue de 32 projets simulés dans 28 domaines de gestion.
- Création de dossiers, instruction, inscription au Conseil de Paris fictif,
  vote de 163 sièges fictifs, adoption/rejet et suivi des travaux dans le
  temps de jeu. Le vote fictif n'est pas celui des conseillers réels.
- Deux enveloppes de programmation municipales purement fictives (investissement
  et fonctionnement), séparées des montants du budget officiel publié.
- Partenaires réels identifiés ; les compétences de l’État, de la région,
  d’Île-de-France Mobilités et d'autres organismes ne sont pas usurpées.
- Un projet de démolition ne modifie pas automatiquement les bâtiments
  IGN et n'autorise pas de démolir un monument protégé.
- Simulation de mobilité agrégée par 80 quartiers (indices relatifs fictifs,
  base 100, pas de vraies fréquentations ni véhicules/personnes 3D) ;
  aucun calcul coûteux n'est ajouté à chaque image.
- Sauvegardes v1 antérieures compatibles avec le champ municipal facultatif.

Prochaines phases : permissions et patrimoines fonciers individuels, achats,
consultation publique, commissions et amendements, budgets pluriannuels,
demandes des citoyens, flux et réseaux spatialisés calibrés sur observations
anonymisées officielles, services et agents, conséquences intersectorielles.
