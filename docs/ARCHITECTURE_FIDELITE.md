# Reconstruction architecturale documentée — protocole 0.26.3 → 0.27

## Principe de véracité

**Une emprise IGN, un volume municipal et un toit dérivé de LiDAR ne sont pas, à eux seuls, une maquette architecturale détaillée.** Ils localisent l'édifice et permettent d'en mesurer certaines surfaces, mais ne donnent pas systématiquement les fenêtres, travées, entablements, balustrades, sculptures, ferronneries, charpentes ou ornements. Toute mesure annoncée « attestée » doit être reliée à un document précis, avec son édition, sa date, ses unités et sa précision publiée. Les mesures inférées d'un dessin non coté sont des estimations, jamais des cotes garanties. Les dimensions du support papier (par ex. 110 × 78,2 cm) ne sont pas celles de la façade représentée.

**Le moteur actuel reste en version 0.26.3.** L'index `public/data/metropole/architecture/models/index.json` est **volontairement vide** : à ce stade aucun maillage monumental intégral n'a passé une revue complète des cotes et des éléments architecturaux. Le jeu conserve donc provisoirement ses bâtiments IGN à l'endroit des monuments ; le panneau des fiches en indique explicitement la limite. Il n'est pas affirmé que la fidélité visuelle est parfaite.

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

Le relevé et ses conditions sont accessibles dans la [fiche numérique de l'Hôtel de Ville](../public/data/metropole/architecture/survey-4e.json). Le moteur 3D du 4e utilise le fichier `public/data/4e/roof-lidar.json` lorsqu'il est disponible. **Aucune maquette architecturale monumentale intégrale n'est encore déclarée conforme, et la version reste 0.26.3.**

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

**Toit LiDAR :** aucune toiture validée ne correspond actuellement à cet édifice dans `public/data/4e/roof-lidar.json`. La génération rejetait mécaniquement les polygones dépassant 500 points alors que l'Hôtel de Ville en comporte 592 avant même l'échantillonnage. La procédure spécialisée `scripts/prepare_lidar_roofs_4e.py` autorise maintenant jusqu'à 3 600 points pour cet identifiant, avec un pas de 2,5 m issu de mesures MNH, et exige au moins 95 % de triangles de toiture effectivement échantillonnés. Les hauteurs demeurent celles de véritables pixels IGN ; si les données manquent ou sont incohérentes, **aucune toiture inventée ne remplace l'IGN existant**. Les façades, baies, sculptures et ornements restent à reconstruire à partir des dessins d'exécution.

Le niveau de précision actuel est donc **emprise documentée**, non « maquette parfaite » ni « façade certifiée ». La version reste 0.26.3.

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

`src/architectureModels.ts` est un lecteur Babylon.js **sans texture ni satellite**. Les fichiers LOD futurs sont des fichiers JSON métriques géoréférencés contenant sommets, triangles et références d'archives. Une maquette experte est chargée sur demande près de la caméra ; **uniquement après succès**, les triangles du ou des bâtiments IGN remplacés sont masqués dans la tuile, sans effacer leurs voisins. Si le chargement échoue, les volumes d'origine restent visibles. En quittant le lieu, la géométrie IGN est rétablie.

**Limite de la présente livraison :** aucun modèle certifié n'est encore disponible. La lecture des vrais cahiers de calepinage est une première étape documentaire, pas l'achèvement de l'Hôtel de Ville ou une promesse d'exactitude au millimètre.
