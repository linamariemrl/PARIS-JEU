# PARIS : référence technique Cities: Skylines et écosystème de mods

Version du cadrage : 07/11/2026. Cette étude guide PARIS et ne change pas son objectif.

## 1. Deux projets différents

Cities: Skylines est un jeu de création d'une ville fictive. PARIS est une simulation et une exploration de Paris **réel** dans sa géographie et ses limites administratives, avec un joueur maire de Paris, des communes limitrophes autonomes, les compétences juridiques réelles, aucun scénario et aucun déblocage.

Nous cherchons à apprendre des choix d'ergonomie, de rendu, de simulation et de modularité des Cities: Skylines I et II, pas à importer leur univers, leurs bâtiments commerciaux, leurs données d'équilibrage, leur moteur de jeu ou leur contenu sous droits.

La première priorité reste la représentation 3D vérifiable des bâtiments du 4e, la qualité graphique sur Android, puis le passage à tout Paris avant le véritable moteur de gestion (étape 4). Aucun système de zonage ou de construction libre de ville fictive ne remplace le PLU, les permis, les contraintes patrimoniales et les pouvoirs réels du maire.

## 2. Ce que nous reprenons comme principes

| Inspiration Cities | Traduction pour PARIS | Quand |
| --- | --- | --- |
| Déplacement, caméra libre, sélection et outils précis | Gestes Android naturels, vue carte/rue, pas de collision de bâtiments, caméra réellement 360 degrés à terme, mode précision optionnel | Étapes 2 à 3 |
| Assets de bâtiment, variantes, couches de matériaux | Identifiants IGN stables, volumes bâtis par subdivision, façades documentées, toitures LiDAR, matériaux PBR libres, provenance par segment | Étapes 2 à 3 |
| LOD, instancing, streaming et textures mutualisées | Qualités Bas/Moyen/Haut, phototuiles et bâtiments par emprise, modèles proches/lointains, cible au moins 30 FPS sur Android récent | Étapes 2 à 3 |
| Outils de précision pour réseaux et intersections | Voirie et marquages réels provenant d'OSM / autorités, avec rendus par type de voie; aucune importation de réseau imaginaire | Étape 3 |
| Simulations trafic et transports en réseau | Graphe de mobilité multimodal IDFM/OSM, agents dans le secteur visible et flux agrégés ailleurs, objectifs et coûts de déplacement | Transports après socle |
| Vues d'information d'un city builder | Couches thématiques discrètes et optionnelles: trafic, logements, finances, santé, pollution, équipements | Étapes 4 et suivantes |
| Extensions et mods par systèmes indépendants | Modules autonomes contrôlés, lisant un état partagé, mutations validées par la compétence légale (Ville, État, Région, etc.) | Étape 4 et suivantes |
| Flux de simulation mis à jour à des fréquences différentes | Rendu à la fréquence GPU; simulation à pas fixes indépendants; rapprochement visuel agents/flux sans tout calculer sur le GPU | Étapes 4 et suivantes |

Sources de vérification :
- Paradox, « Modding Dev Diary #3: Code Modding » : https://www.paradoxinteractive.com/games/cities-skylines-ii/modding/dev-diary-3-code-modding
- Paradox, « Cities: Skylines II Feature #2: Traffic AI » : https://www.paradoxinteractive.com/games/cities-skylines-ii/features/traffic-ai
- Paradox, guide de performance actualisé en 2026 : https://support.paradoxplaza.com/hc/en-us/articles/14648080779538-Cities-Skylines-2-Our-Guide-to-Optimizing-Performance

## 3. Références de mods compatibles avec une étude de code

### Move It! (Cities: Skylines I et II)

- Sources : https://github.com/Quboid/CS-MoveIt et https://github.com/Quboid/CS2-MoveIt
- Licence déclarée par GitHub : MIT.
- Intérêt : distinction sélection / déplacement, précision, fluidité et manipulations sans sauts.
- Portage éventuel : algorithmes d'interaction **réécrits/adaptés** en TypeScript aux gestes Android. Aucun outil de reconstruction d'une ville fictive n'est requis.
- Statut : référence, code externe **non intégré**.

### Traffic Manager: President Edition (TM:PE)

- Source : https://github.com/CitiesSkylinesMods/TMPE
- Licence déclarée : MIT.
- Intérêt : simulation des règles d'intersection, priorité, contraintes des voies et configuration des flux.
- Portage éventuel : les règles abstraites documentées vers un graphe IDFM/OSM original, en respectant le code de la route et les pouvoirs de la Ville de Paris. Pas d'import du moteur Unity.
- Statut : étude pour le module Transports, **non intégré**.

### Intersection Marking Tool

- Référence : https://www.nexusmods.com/citiesskylines/mods/160
- Licence MIT indiquée pour le code du mod, à revalider sur le dépôt original et pour toute dépendance avant portage.
- Intérêt : couches de marquage au sol, intersections, lignes et passages piétons, sans multiplier les objets lourds.
- Portage éventuel : génération de géométries légères sur des tracés réels, en distinguant données constatées et éléments procéduraux.
- Statut : référence visuelle et algorithmique, **non intégré**.

**Condition impérative** : un mod publié dans un atelier de jeu n'est pas automatiquement librement copiable. Une licence MIT peut autoriser l'adaptation du **code du mod** à condition de conserver sa licence et ses mentions de droit d'auteur. Cela n'accorde pas les droits sur le code propriétaire de Cities: Skylines, son moteur Unity, ses modèles, ses textures, ses images ou les assets tiers. Les dépendances et les licences d'assets se vérifient séparément. Les versions et les engagements de compatibilité doivent également être contrôlés au moment exact d'un éventuel portage.

## 4. Organisation des composants futurs

- **Couche géographique source**, immuable : IGN, Ville de Paris, OSM, IDFM, Apur, LiDAR et photographies libres. Provenance, géométrie, confiance et date de validité.
- **Couche 3D** Babylon.js : maillages / matériaux par lot, LOD, chargement progressif, skybox, caméras, occlusion, éclairage. Rendu non autoritaire sur les politiques municipales.
- **Couche simulation** : état partagé par îlot/quartier/arrondissement, agents de proximité et flux métropolitains agrégés, calendrier et événements. Modules autonomes et pas de calculs.
- **Couche des compétences légales** : validation qui peut décider de quoi; la simulation sépare décision municipale, avis consultatif et négociation avec les autres institutions.
- **Couche interaction** : menus et cartes d'information affichant conséquences, coûts et responsabilités sans mission imposée.
- **Format de contributions** : chaque nouveau modèle ou règle doit déclarer licence, auteur, source, versions supportées, statut observé/reconstitué/inconnu et budget de ressources sur Android. L'application n'exécutera pas de code tiers arbitraire téléchargé dans la PWA.

## 5. Ordre des intégrations

1. Garder la carte actuelle fonctionnelle et stable. Ne pas réintroduire les noms de rue sans nouvelle demande.
2. Exploiter les 3 260 subdivisions municipales identifiées et les données LiDAR pour obtenir des **formes** réellement crédibles, avec les hauteurs IGN comme référence. Améliorer d'abord le 4e.
3. Concevoir des familles de façades et toits réutilisables, mais associer une famille spécifique seulement aux bâtiments dont l'époque et le style ont été vérifiés. Ne pas déclarer « haussmannien » sur une simple intuition.
4. Ajouter des vrais marquages, trottoirs, quais, ponts, végétation 3D et monuments, progressivement sur les photographies au sol. Tester Bas/Moyen/Haut.
5. Optimiser par lots, atlas, distance et frustum. Sans disparition de bâtiments au zoom : leur représentation visuelle peut être simplifiée, leur localisation ne doit pas changer.
6. Étendre aux vingt arrondissements et aux communes limitrophes; construire ensuite le socle de simulation, les finances, les transports et les autres domaines prévus.

Critère de succès : si un nouveau rendu ressemble mieux à un jeu vidéo mais devient faux pour une rue ou un immeuble identifiable, il ne constitue pas une validation de la fidélité de PARIS. Et si une reproduction exacte ne passe pas sur Android, proposer un LOD ou une substitution visuelle explicitement déclarée au lieu de produire un code inutilisable.
