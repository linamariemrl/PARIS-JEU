# Reconstruction architecturale documentée — protocole 0.26 → 0.27

> **État au 9 novembre 2026 :** version publique **0.26.4**. Le toit LiDAR mesuré de l'Hôtel de Ville est accepté et publié (0.26.4). Aucune maquette architecturale n'est certifiée ; la 0.27 reste verrouillée. Les sections datées ci-dessous conservent la chronologie technique ; les mentions « 0.26.3 » y décrivent l'état d'alors.

## Principe de véracité

**Une emprise IGN, un volume municipal et un toit dérivé de LiDAR ne sont pas, à eux seuls, une maquette architecturale détaillée.** Ils localisent l'édifice et permettent d'en mesurer certaines surfaces, mais ne donnent pas systématiquement les fenêtres, travées, entablements, balustrades, sculptures, ferronneries, charpentes ou ornements. Toute mesure annoncée « attestée » doit être reliée à un document précis, avec son édition, sa date, ses unités et sa précision publiée. Les mesures inférées d'un dessin non coté sont des estimations, jamais des cotes garanties. Les dimensions du support papier (par ex. 110 × 78,2 cm) ne sont pas celles de la façade représentée.

**Le moteur actuel est en version 0.26.4 (0.26.3 à la rédaction initiale de ce protocole).** L'index `public/data/metropole/architecture/models/index.json` est **volontairement vide** : à ce stade aucun maillage monumental intégral n'a passé une revue complète des cotes et des éléments architecturaux. Le jeu conserve donc provisoirement ses bâtiments IGN à l'endroit des monuments ; le panneau des fiches en indique explicitement la limite. Il n'est pas affirmé que la fidélité visuelle est parfaite.

## Sources obligatoires et usage géométrique

1. **[Archives de Paris](https://archives.paris.fr)** : permis, élévations, coupes, plans cotés, archives administratives.
2. **[MPP](https://mediatheque-patrimoine.culture.gouv.fr)** : dossier de protection, plans de restauration, croquis cotés, études techniques. [Relevés du Centre de recherches sur les Monuments historiques](https://mediatheque-patrimoine.culture.gouv.fr/le-centre-de-recherches-sur-les-monuments-historiques). **Archiv'MH n'offre souvent que les inventaires en ligne ; de nombreux documents restent consultables sur place**. [Conditions](https://mediatheque-patrimoine.culture.gouv.fr/un-document-darchives).
3. **[Gallica — BnF](https://gallica.bnf.fr)** : albums d'architecture, ouvrages originaux de construction, planches et notices numérisées.
4. **[Cité de l'architecture et du patrimoine](https://www.citedelarchitecture.fr)** : archives d'architectes, dossiers de construction, maquettes et relevés.
5. **[IGN LiDAR HD](https://geoservices.ign.fr/lidarhd)** : nuage de points, toiture et surfaces visibles. Ne révèle pas toutes les faces dissimulées, les intérieurs ou la géométrie précise de toutes les sculptures.
6. **[Open Data Paris](https://opendata.paris.fr/explore/dataset/volumesbatisparis/)** : volumes subdivisés, emprises et étagement des constructions ; conserver les attributs, incertitudes et millésimes.
7. **Complément indispensable [Bibliothèque de l'Hôtel de Ville — bibliothèques spécialisées](https://bibliotheques-specialisees.paris.fr)** : cahiers de calepinage et dessins **d'exécution** numérisés, patrimoine municipal.
8. **Complément [Paris Musées / musée Carnavalet](https://www.parismuseescollections.paris.fr)** : plans, élévations, coupes et manifestes IIIF, chaque planche accompagnée de son numéro de collection.

Le corpus consultable se trouve dans `public/data/metropole/architecture/dossiers.json` : **195 sites et édifices à instruire**, dont 140 références POP/Mérimée géolocalisées et 55 candidats sans appariement certain. Il ne s'agit pas de 195 modèles architecturaux achevés.

## Toiture mesurée de l'Hôtel de Ville — contrôle validé

Le rapport `data/quality/lidar-4e-reconstruction.json` contient désormais un **relevé LiDAR accepté** pour l'Hôtel de Ville de Paris (identifiant IGN `BATIMENT0000000245157267`). Deux dalles IGN MNH contiguës ont été mosaïquées en Lambert-93 au pas **0,5 m sans interpolation des pixels**. Après contrôle de la triangulation à 2,5 m, le résultat contient **3 490 triangles**, **2 047 sommets échantillonnés** et une couverture de **98,26 %** de l'emprise géométrique. Le maximum des valeurs de hauteur MNH retenues est de **48,21 m** ; la médiane est de **26,84 m** et le 90e percentile de **35,65 m**.

La [Ville de Paris indique un campanile à 50 m de hauteur](https://www.paris.fr/pages/l-hotel-de-ville-abrite-cinq-lieux-insolites-7659). Cela fournit une contrainte indépendante de l'attribut de hauteur générale IGN à 25,2 m. La mesure source du campanile est **arrondie**. La géométrie des pixels LiDAR reste une reconstruction de **relief de toiture**, susceptible de différences dues à la végétation, aux éléments masqués ou à la simplification. Elle **ne certifie pas** la fidélité des ornements, des façades, des baies, des sculptures ou du campanile dans leur détail. Une telle certification exige une comparaison aux plans cotés, relevés photogrammétriques et pièces d'exécution.

Le relevé et ses conditions sont accessibles dans la [fiche numérique de l'Hôtel de Ville](../public/data/metropole/architecture/survey-4e.json). Le moteur 3D du 4e utilise le fichier `public/data/4e/roof-lidar.json` lorsqu'il est disponible. **Aucune maquette architecturale monumentale intégrale n'est encore déclarée conforme.** Ce toit a été publié en 0.26.4.

## Avancement du relevé métrique — 9 novembre 2026

Le premier contrôle croise **la notice Mérimée** avec **un sommet de l'emprise IGN** seulement si le point officiel tombe **dans le polygone réel**, hors cours intérieures. Les mesures de surface et de dimensions sont ensuite **calculées à partir de l'emprise géographique** dans le repère local du moteur (projection simplifiée de WGS84). Ce ne sont ni des cotes de chantier, ni des garanties cadastrales ou photogrammétriques.

[Relevé reproductible de trois monuments du 4e](../public/data/metropole/architecture/survey-4e.json) · [script de reproduction](../scripts/prepare_architecture_survey_4e.py).

| Édifice | Référence POP | Objet IGN retrouvé | Enveloppe calculée | Aire horizontale projetée | Hauteur attribuée IGN |
| --- | --- | --- | --- | --- | --- |
| Hôtel de Ville | PA00086319 | BATIMENT0000000245157267 | 125,82 × 163,09 m | 10 251,55 m² | 25,2 m |
| Notre-Dame | PA00086250 | BATIMENT0000000305564422 | 106,96 × 63,00 m | 2 148,13 m² | 34,9 m |
| Saint-Gervais-Saint-Protais | PA00086257 | BATIMENT0000000253243449 | 81,60 × 60,79 m | 2 776,07 m² | 17,8 m |

**Limites décisives :** il s'agit de rectangles enveloppes et d'aires de polygones, non des dimensions exactes des façades ; les 25,2 m de l'Hôtel de Ville et les 34,9 m de Notre-Dame ne sont **pas** les cotes totales des clochers, flèches ou statues. Les dates et précisions des relevés IGN demeurent celles de la source. La précision du calcul affiché au centimètre n'implique **aucune exactitude sur le terrain au centimètre**.

**Hôtel de Ville :** l'emprise IGN comporte quatre anneaux et 592 sommets. Le registre `public/data/4e/city-volumes.json` atteste **onze polygones de subdivisions**, couvrant **83,1 %** de l'emprise selon son attribut source. Le moteur existant exige 90 % pour remplacer une extrusion intégrale par des subdivisions, notamment parce que leur hauteur intermédiaire n'est pas mesurée. Ces subdivisions sont donc documentées **sans les faire passer pour des masses 3D exactes**.

**Toit LiDAR (historique, dépassé) :** au moment de ce relevé, aucune toiture validée ne correspondait à cet édifice dans `public/data/4e/roof-lidar.json` ; elle y figure depuis la 0.26.4 (voir « Toiture mesurée de l'Hôtel de Ville — contrôle validé »). La génération rejetait mécaniquement les polygones dépassant 500 points alors que l'Hôtel de Ville en comporte 592 avant même l'échantillonnage. La procédure spécialisée `scripts/prepare_lidar_roofs_4e.py` autorise maintenant jusqu'à 3 600 points pour cet identifiant, avec un pas de 2,5 m issu de mesures MNH, et exige au moins 95 % de triangles de toiture effectivement échantillonnés. Les hauteurs demeurent celles de véritables pixels IGN ; si les données manquent ou sont incohérentes, **aucune toiture inventée ne remplace l'IGN existant**. Les façades, baies, sculptures et ornements restent à reconstruire à partir des dessins d'exécution.

Le niveau de précision était alors **emprise documentée**, non « maquette parfaite » ni « façade certifiée » ; il est aujourd'hui **emprise et toiture LiDAR mesurées**, façades non reconstruites.

### Relevé MNH multi-hauteurs — contrôle du campanile

La [Ville de Paris indique officiellement un campanile à 50 mètres de hauteur](https://www.paris.fr/pages/l-hotel-de-ville-abrite-cinq-lieux-insolites-7659). Cette valeur est **descriptive et arrondie** ; elle ne constitue ni une élévation d'architecte cotée au centimètre, ni une hauteur universelle des façades. Le **corps de bâtiment IGN** possède un attribut distinct de **25,2 m**. Les 2 mesures ne sont donc **pas interchangeables**.

Dans la mosaïque MNH du 9 novembre 2026, **3 436 triangles**, **2 035 points de hauteur** et **96,616 % de la toiture** ont été obtenus à partir des pixels IGN, mais le résultat était refusé parce que le 90e percentile (**34,98 m**) dépassait la tolérance relative à la hauteur IGN globale (**25,2 m**). Cela ne démontre pas une erreur du relevé : les pavillons et le campanile doivent être étudiés séparément.

La procédure autorise désormais **uniquement pour cet édifice** les valeurs de hauteur MNH effectivement mesurées jusqu'au plafond de **50,0 m** confirmé par la Ville de Paris. La limite ordinaire des autres bâtiments reste inchangée ; les exigences de **95 % minimum de surface triangulée**, de pixels géoréférencés **au pas 0,5 m**, de triangulation sans traverser les cours et de cohérence des médianes restent maintenues. Le campanile réel peut avoir des particularités non captées par cette limite arrondie. La reconstruction correspond à un **relief LiDAR de couverture**, et non à une maquette complète du monument : les fenêtres, lucarnes, sculptures, corniches et façades doivent encore être reconstruits à partir des dessins d'exécution. Le statut `publicationAllowed=false` reste conservé pour la maquette architecturale intégrale.

## Premier dossier : Hôtel de Ville de Paris

Référence POP : **PA00086319** ; façade reconstruction de Théodore Ballu et Édouard Deperthes. La [notice du ministère](https://pop.culture.gouv.fr/notice/merimee/PA00086319) identifie le monument et sa protection, mais **ne fournit pas les cotes des ornements**. Un dossier complet peut nécessiter consultation de la MPP.

**Documents d'exécution précis retrouvés dans les fonds BHdV :**

- **CC64_PL34** : [Bâtiment central Boccador, XIVe assise, coupe, façade sur place de l'Hôtel-de-Ville (1878)](https://bibliotheques-specialisees.paris.fr/in/imageReader.xhtml?ark=73873%2Fpf0000712758%2F0034%2Fv0001.simple.selectedTab%3Drecord.hidesidebar&id=ark%3A%2F73873%2Fpf0000712758%2F0034&selectedTab=record&updateUrl=updateUrl) ; métré de septembre 1878.
- **CC16_pl39** : [Tourelle du côté du Préfet : plans, élévations, coupes, fermetures des baies (1878)](https://bibliotheques-specialisees.paris.fr/in/imageReader.xhtml?ark=73873%2Fpf0000570031%2F0039%2Fv0001&id=ark%3A%2F73873%2Fpf0000570031%2F0039&updateUrl=updateUrl) ; métré d'octobre 1878.
- **CC76_PL04** : [Façade Boccador, deuxième étage, profils et détails (1881)](https://bibliotheques-specialisees.paris.fr/in/imageReader.xhtml?ark=73873%2Fpf0000570575%2F0004%2Fv0001&id=ark%3A%2F73873%2Fpf0000570575%2F0004&updateUrl=updateUrl) ; feuille approuvée pour exécution le 4 février 1881.
- **Carnavalet, série de douze planches** : [plans et élévations du nouvel Hôtel de Ville](https://parismuseescollections.paris.fr/fr/musee-carnavalet/oeuvres/serie-de-12-planches-presentant-les-plans-et-elevations-du-nouvel-hotel-de) ; la [façade principale](https://www.parismuseescollections.paris.fr/fr/musee-carnavalet/oeuvres/hotel-de-ville-de-paris-facade-principale) est la planche 5 (IIIF `320291169`).
- **Carnavalet, dessin Deslandes** : [plan de l'ensemble reconstruit](https://www.parismuseescollections.paris.fr/fr/musee-carnavalet/oeuvres/hotel-de-ville-de-paris-plan-actuel-de-l-hotel-de-ville-reconstruit-par), fonds I.G.3774, IIIF `320064500`.

État : **sources cotées localisées ; aucune cote du bâtiment encore lue et transcrite avec provenance dans notre registre**. Le suivant est donc *le relevé manuel ou géométrique des mesures réellement inscrites sur ces documents*, puis la confrontation à un relevé actuel IGN LiDAR HD et à l'emprise Paris Data. Ne pas tracer de façade « ressemblante » à main levée et ne pas déduire une hauteur à partir de la taille des planches.

## Second dossier : Tour Eiffel

Source d'exploitant : [Chiffres clés](https://www.toureiffel.paris/fr/le-monument/chiffres-cle) ; hauteur actuelle publiée **330 m**, largeur au sol **125 m**, premier étage **57 m**, deuxième **115 m**, troisième **276 m**, largeur d'un pied **25 m**. Il s'agit de **valeurs institutionnelles arrondies**, pas d'une cote centimétrique. [L'histoire officielle](https://www.toureiffel.paris/fr/le-monument/histoire) reproduit certaines planches originales de Gustave Eiffel ; [Gallica](https://gallica.bnf.fr/accueil/fr/html/gallica-aux-couleurs-de-la-tour-eiffel) renvoie vers son ouvrage technique. Les éléments métalliques, rivets, treillis et assemblages exigent une étude spécifique des dessins d'atelier, non une interpolation depuis la seule hauteur générale.

## Troisième et quatrième dossiers

- **Notre-Dame — PA00086250** : [fonds MPP, série de plans et journal de travaux](https://mediatheque-patrimoine.culture.gouv.fr/recherches-dans-les-archives) ; distinguer état ancien et restaurations après l'incendie de 2019 ; aucune cote fine encore transcrite.
- **Arc de Triomphe — PA00088804** : [CMN](https://www.paris-arc-de-triomphe.fr/visiter/informations-pratiques), hauteur générale publiée **50 m** (arrondie) ; plans d'exécution et détail sculpté restant à rechercher.

## Chaîne d'acquisition et critères techniques

1. **Identifier chaque feuille** par institution, cote/ARK/IIIF, auteur, année, version, licence et lien pérenne. Vérifier qu'elle décrit le bâtiment **actuel**, pas un état détruit ou un projet abandonné.
2. **Étalonner** un plan coté : unité, échelle, repères de contrôle, conversion de l'orthogonalité. Si le dessin n'est pas coté, l'écart est **inconnu** et le fichier demeure en statut documentaire. Ne pas attribuer au bâtiment les dimensions physiques de l'image papier.
3. **Géoréférencer** avec des points stables relevés dans un système métrique officiel (préférentiellement **Lambert-93 EPSG:2154**), puis convertir dans les coordonnées métriques de scène du moteur. Conserver les résidus en mètres et vérifier les différences d'échelle dues à la projection simplifiée du moteur.
4. **Bâtir le modèle de référence** : emprise, percements vrais, travées, hauteurs, toitures, détails d'ornements lorsque documentés, y compris les éventuelles démolitions ou transformations. Segmentation par pièce et par source. Aucun détail non documenté ne doit être inventé.
5. **Croiser les données actuelles** : Volumes bâtis, MNS/MNH et nuages LiDAR HD, photogrammétrie/récolement si autorisés et métriquement fiables. Contrôle de points indépendants avec tableau des écarts ; statut incertain lorsqu'une source historique contredit un relevé contemporain.
6. **Produire les LOD** à partir du même modèle de référence haute définition : maillage léger au loin, moyen à distance intermédiaire, détaillé en vue rapprochée ; on **ne reconstruit pas** de fausses décorations à basse résolution. Le modèle archivé reste de plus haute fidélité que sa version Android.
7. **Certification de publication** : ouvrir explicitement `publicationAllowed` après vérification documentée des cotes, du géoréférencement, des reliefs et du maillage. L'audit `python scripts/audit_architectural_models.py` vérifie les sources, données numériques, géométrie et index. Aucun ajout au moteur sans ces validations.

## Moteur et conservation de l'interface

`src/architectureDossiers.ts` ajoute, dans les **fiches existantes**, le détail des plans retrouvés, mesures attestées, valeurs arrondies et lacunes. Cela ne rajoute aucun bouton ou écran permanent.

`src/architectureModels.ts` est un lecteur Babylon.js **sans texture ni satellite**. Les fichiers LOD futurs sont des fichiers JSON métriques géoréférencés contenant sommets, triangles et références d'archives. Une maquette experte est chargée sur demande près de la caméra.

### Substitution extrusion IGN ↔ maquette (navette R02 : D1, D2, D3, D7)

- **Table de correspondance (D3)** : `public/data/metropole/architecture/heritage-footprints.json`, générée par `scripts/prepare_heritage_footprints.py`. C'est la **seule** source qui dit quelles emprises IGN une maquette remplace : le moteur ne fait plus d'inférence géographique pour le masquage. Règle : le point POP/Mérimée tombe dans le contour IGN (115 références), ou dans une **cour fermée** de ce contour, ce qui désigne sans ambiguïté le bâtiment qui l'entoure (2 références : Garde-Meuble, Invalides). Les 23 autres références (cours d'honneur ouvertes, grands ensembles, point hors emprise) ne sont **pas** rattachées ; la distance à l'emprise la plus proche est notée pour une complétion manuelle. Les 55 dossiers « candidats » sans référence POP n'y figurent pas. Une emprise peut porter plusieurs références et une référence plusieurs emprises.
- **Maillages séparés (D1)** : à la construction de la tuile, chaque emprise listée reçoit son propre maillage mur et toit, de même couleur que dans les lots. Remplacer revient à `isVisible=false` : aucune réécriture d'indices, aucune allocation, réversible immédiatement.
- **Proxy de sélection (D2)** : l'extrusion masquée reste activée et sélectionnable. Le prédicat `isBuildingPickProxy` exige `isEnabled()` mais ne teste pas `isVisible` (avec un prédicat, Babylon 8 n'applique plus ses propres tests). Les maquettes ne sont jamais sélectionnables.
- **Ordre sûr (D7)** : charger, valider, afficher, puis seulement masquer. En cas d'échec, l'extrusion reste. En quittant le lieu, l'extrusion est restituée avant la destruction de la maquette.
- **Contrôle géométrique réel** (`polygonCoverage`, `src/heritageFootprints.ts`) : la boîte englobante n'est qu'un précontrôle. L'acceptation compare l'**emprise IGN réelle** (contour extérieur moins les cours fermées) à la **projection horizontale des triangles** de la maquette, par échantillonnage (10 000 points au plus). Il faut au moins **95 %** de l'intérieur de l'emprise couvert et au plus **5 %** de débordement (cour comblée, aile inventée, décalage), hors d'une bande de **1 m** le long des bords. Ce réglage de 1 m est prudent mais **n'est pas encore justifié** par la précision publiée de chaque source : il devra l'être avant toute certification. Toutes les emprises de la référence doivent être chargées ; sinon la validation est différée, pas rejetée. Une maquette murs seuls (sans toiture ni terrasse) ne couvre rien en projection et est rejetée. Coût mesuré : environ 15 ms sur poste de travail pour l'Hôtel de Ville (592 sommets, 3 cours), une seule fois par maquette (résultat mémorisé) ; non mesuré sur téléphone.
- **Pas de double silhouette** : si une autre référence active (ensemble ou partie) remplace déjà une emprise, une seconde maquette complète sur la même emprise est différée.

**Ce qui est vérifié, et comment :** quatre niveaux distincts, qui prouvent des choses différentes.

| Comportement | Unitaire Node | Scène Babylon NullEngine | Flux `main.ts` réel (Chromium, WebGL SwiftShader) | Android |
| --- | --- | --- | --- | --- |
| Index plusieurs-à-plusieurs, lecture stricte | oui | oui (2 références sur l'emprise de l'Hôtel de Ville) | — | non |
| Polygones : cour comblée, forme fausse de même boîte, murs seuls, décalage | oui (formes synthétiques) | oui (emprise réelle : pavé plein rejeté, débordement 91,9 % ; toiture exacte acceptée à 100 % ; décalage de 6 m rejeté) | — | non |
| Mêmes triangles et mêmes bâtiments après séparation | — | oui | — | non |
| Masquage sans toucher les voisins | oui | oui | oui (capture) | non |
| Sélection via l'extrusion invisible | oui (prédicat) | oui (`pickWithRay`) | **oui : tap au centre, fiche « Hôtel de ville » ouverte, avec et sans maquette** | non |
| Changement de LOD sans double affichage | oui | oui | — | non |
| 25 allers-retours sans maillage ni géométrie orphelins | — | oui | — | non |
| Tuile rechargée pendant que la maquette est active | oui | oui | — | non |
| Fichier absent, réseau coupé puis rétabli, JSON tronqué, triangle mal formé | — | oui | — | non |
| Niveau changé pendant une requête en vol | — | oui (réponse périmée jetée) | — | non |
| Mode quartiers sur le même tap | — | — | **non testé** : `quarters.json` est produit par la CI et absent du build local | non |

Les maquettes des essais sont des **faux** marqués `test-fixture` : un pavé ou une toiture plate triangulée sur le polygone IGN. Dans le flux navigateur (`scripts/browser/check_heritage_main_flow.mjs`, hors CI), ils sont injectés par **interception réseau** ; le dossier de l'Hôtel de Ville y est aussi passé à `publicationAllowed=true` dans la seule réponse interceptée. Le dépôt n'est pas modifié, l'index des modèles reste vide, et **aucun modèle d'archive réel n'a traversé cette chaîne**. Résultat du flux réel : 65 → 64 draw calls (−2 extrusion, +1 maquette), sélection identique. Captures : [avec la maquette factice](preuves/r02-flux-main-maquette-factice.png), [sans maquette](preuves/r02-flux-main-sans-maquette.png).

### Corrections R02 : D4 et D6 implémentés, D5 restant

Définitions reprises de la navette R02 (section R02-D).

- **D4, remplacement partiel par partie certifiée : implémenté (extension additive).**
  - Une entrée de `models/index.json` peut déclarer `replacement:"partial"`, un `partId` et une `partFootprint` (polygone 2D en coordonnées de scène), avec des fichiers `PA########-<partId>-<niveau>.json`.
  - Elle n'est autorisée que si le dossier liste cette partie dans `certifiedParts` (statut `measured-and-approved`, sources du dossier). Le verrou global `publicationAllowed` du monument **n'est pas levé**. Aucune partie n'est certifiée aujourd'hui (vérifié par test).
  - Contrôle : l'emprise déclarée doit être posée sur l'emprise IGN (tolérance 1 m, une cour est refusée), et **chaque sommet** de la maquette doit tomber dans cette emprise déclarée. Une façade est presque verticale : sa projection horizontale ne couvre rien, donc on contrôle l'appartenance des sommets plutôt qu'une couverture.
  - Comme le prévoit R02-D4, tant que la découpe de l'extrusion par partie n'est pas fiable, **une partie ne masque rien** : elle est superposée à l'extrusion avec un simple décalage de profondeur (`zOffset`, aucune géométrie déplacée). L'extrusion reste la seule cible de sélection, donc jamais de double clic.
  - Une partie n'est jamais posée sur une maquette complète active ; si une maquette complète arrive, les parties de la référence sont retirées. Les maquettes complètes gardent leur comportement et leur verrou.
  - Reste à faire : masquer seulement la portion d'extrusion couverte par une partie, ce qui demande une découpe géométrique fiable des extrusions.
- **D6, LOD avec hystérésis : implémenté** (`src/lodHysteresis.ts`). On passe au niveau moyen au-delà de 700 m et on revient au haut sous 600 m ; on passe au bas au-delà de 1 600 m et on revient au moyen sous 1 400 m. Le niveau précédent reste affiché jusqu'à ce que le suivant soit prêt. Ces seuils restent **à calibrer sur appareil**.
- **D5, repère des modèles : non implémenté.** Objectif : master en EPSG:2154 avec une origine propre (`originL93`) et des sommets relatifs, transformation vers la scène lue dans `registration/PA########.json`. Fichiers : `src/architectureModels.ts`, nouveau `registration/`. Données manquantes : un calage réel (points d'appui et résidus) ; aucune feuille n'est encore calée. Ordre : après le calage de CC64_PL34, avant le premier modèle réel. Réussite : changer `CENTER` dans `src/geo.ts` ne déplace pas une maquette par rapport à son emprise.

Tests D4/D6 en scène Babylon, sur l'emprise réelle de l'Hôtel de Ville :
- une façade factice certifiée, posée sur l'arête la plus longue, est superposée sur 3 niveaux de détail, tandis que l'extrusion reste visible et seule sélectionnable ;
- une partie non certifiée n'est jamais téléchargée ;
- une partie déclarée dans une cour est rejetée, de même qu'une maquette débordant de 3 m ;
- maquette complète contre partie : jamais les deux, et la partie revient quand la maquette complète sort du champ ;
- en orbite entre 610 et 695 m, aucun rechargement.

Total : **59 contrôles**.

### Coûts structurels et comparaison avec `main`

- **Maillages par tuile** : 49 des 421 tuiles contiennent une emprise suivie, en moyenne 2,4 par tuile concernée et au plus 9 (tuile métropole `-4_0`). Le surcoût est donc d'au plus 18 maillages et draw calls dans le pire cas, s'ils sont tous visibles.
- **Matériaux** : aucun nouveau matériau pour les maquettes complètes ; une copie avec décalage de profondeur par matériau de rôle, créée seulement si une partie certifiée est affichée (aucune aujourd'hui).
- **Réactivation** : 25 allers-retours, puis déchargement et rechargement de tuile, sans maillage ni géométrie orphelins (scène Babylon).
- **Flux réel `main.ts`, même scénario (vol vers l'Hôtel de Ville, tap au centre)** :

| Version | Draw calls (sans / avec maquette factice) | Tas JS (sans / avec) | Sélection après chargement de la maquette |
| --- | --- | --- | --- |
| `main` (masquage par `setIndices`) | 72 / 73 | 133 / 125 Mo | **perdue : « Lieu de Paris »** |
| branche | 65 / 64 | 133 / 125 Mo | **« Hôtel de ville »** |

Le tas varie de quelques Mo d'un essai à l'autre (ramasse-miettes) : il ne montre ni fuite ni gain mesurable. L'écart de draw calls entre `main` et la branche dépend de l'état du chargement des tuiles au moment de la mesure : il n'est pas interprétable seul. Le point net est la **perte de sélection sur `main`**, le risque n° 2 de R01, corrigée par la branche.

### Coût mesuré des maillages séparés

Mesuré le 9 novembre 2026 dans Chromium headless (rendu logiciel SwiftShader, fenêtre 412 × 860), en comparant `main` (avant la PR) et la branche, avec comptage instrumenté des appels WebGL. Vue de départ sur l'Hôtel de Ville, puis environ 360° en mode orbital.

| Mesure | Avant (3 essais) | Après (2 essais complets) |
| --- | --- | --- |
| Draw calls par image, vue fixe | 115, 115, 115 | 123, 123 |
| Draw calls par image, orbite | 106 à 107 en moyenne | 103 à 105 en moyenne |
| Triangles par image, vue fixe | 1 516 459 | 1 515 362 |
| Mémoire des tampons GPU | 30,7 Mo (32,8 Mo en orbite) | 30,7 Mo (32,8 Mo en orbite) |
| Chargement jusqu'à stabilisation | 32 à 39 s | 34 à 35 s |

Un troisième essai « après » s'est stabilisé avant la fin du chargement des tuiles (11,6 s, 1,44 M triangles) : il est écarté.

Conclusion limitée : environ **+8 draw calls (+7 %)** en vue fixe sur l'Hôtel de Ville, triangles et mémoire inchangés, pas de surcoût mesurable en orbite. Les **temps de trame et FPS ne sont pas mesurables** dans cet environnement : le rendu logiciel donne 1 à 2 FPS et des écarts de 320 à 850 ms par image d'un essai à l'autre, sans rapport avec la PR. **Aucune mesure n'a été faite sur téléphone Android** : la fluidité mobile et l'objectif de 30 FPS restent à vérifier sur appareil réel.

### Registre des cotes transcrites

`public/data/metropole/architecture/measurements/PA00086319.json` consigne les cotes **lues** sur la planche BHdV CC64_PL34 (plan de la 14e assise du corps central, façade sur la place, 1878), avec la zone exacte de l'image, le lecteur et le statut.

**Contrôle de fermeture : atteint.** La première lecture (environ 24,8 m contre 29,45 m) s'arrêtait à l'axe S ; la chaîne se poursuit au-delà. Chaque moitié est désormais transcrite segment par segment, avec ses deux extrémités :

- moitié gauche : 0,76 + 0,46 + 1,04 + 0,46 + 8,18 + 0,46 + 1,04 + 0,46 + 3,86 + 0,46 + 3,86 + 0,46 + 3,86 + 0,46 + 3,63 = **29,45** (cote inscrite 29,45) ;
- moitié droite : 0,23 + 0,46 + 3,86 + 0,46 + 3,86 + 0,46 + 3,86 + 0,46 + 1,04 + 0,46 + 8,18 + 0,46 + 1,04 + 0,46 + 0,76 = **26,05** (cote inscrite 26,05).

La jonction 3,63 + 0,23 redonne l'entraxe courant de 3,86, et la façade est symétrique autour de cette travée centrale : 55,50 m entre les bases des tourelles (3,66 chacune, total 62,82 m sous réserve que les cotes des tourelles soient prises sur la même ligne). Ces contrôles sont **recalculés** par les tests à partir des segments, jamais recopiés.

Cela valide la **lecture** du dessin, **pas l'état actuel** : la feuille n'est ni étalonnée ni géoréférencée, la position verticale de l'assise est inconnue, et la comparaison avec l'emprise IGN (généralisée à environ 1 m) n'isole pas le corps central. Le garde-fou du dossier (aucune planche BHdV dans `measurements` de `dossiers.json`) est conservé.

**Première géométrie partielle :** `public/data/metropole/architecture/reference/PA00086319/cc64-pl34-assise14-rythme.json`, dérivée par `scripts/derive_cc64_rhythm.py` du seul registre. C'est le rythme à une dimension de la façade (32 intervalles, 62,82 m), au statut `partial-non-certified` : pas de profondeurs, pas de hauteur, pas de calage, et **aucun code du moteur ne le lit** (vérifié par test). Ce n'est pas une façade.

**Restant à faire pour l'Hôtel de Ville :** lire CC16_pl39 (tourelle, baies), CC76_PL04 (profils), la planche 5 Carnavalet et le plan Deslandes ; établir les profondeurs (0,535 et 0,47 lues, repères à fixer) et la hauteur des assises ; caler la feuille en EPSG:2154 sur plusieurs points avec résidus ; confronter au LiDAR. Le toit MNH accepté (98,26 %, 3 490 triangles) est conservé tel quel.
