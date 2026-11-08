# PARIS — état de référence et ordre des travaux

**Version en développement : 0.25.9.** Nom visible : **Prototype 0.25**.
**Statut : validation Android en cours.** La version 0.26 est interdite
tant que toutes les conditions de réception ci-dessous ne sont pas remplies.

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

## 3. Ordre de réalisation de la branche 0.25

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

## 4. Porte de validation pour la 0.26 (toutes obligatoires)

Voir `docs/RECETTE_ANDROID.md`. Les CI verts ne prouvent ni le rendu
WebGL ni la fluidité réelle sur un mobile. La 0.26 ne pourra être
envisagée qu'avec : zéro artefact majeur, couverture continue,
comportement stable du relief et de l'eau, végétation visible, navigation
fluide, absence de régression des fonctions du jeu, et sauvegardes
restaurées après fermeture et import/export.

## 5. Correctif réseau sans changement de géométrie

- L'atlas IGN abandonne proprement ses maillages incomplets et relance
  jusqu'à trois chargements espacés ; une reconnexion relance le processus.
- Le cache CPU des bâtiments éloignés reprend son préchargement au retour
  du réseau. Le nombre de maillages GPU n'augmente pas pour ce motif.
- Le panneau d'installation indique en ligne/hors ligne, sans prétendre
  vérifier chaque serveur ni synchroniser les sauvegardes entre appareils.
- La version 0.25.9 et l'interdiction de promotion en 0.26 sont maintenues
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
