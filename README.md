## 0.25.6 — cache CPU borné de la voirie détaillée

Une seconde passe de stabilisation limite les latences lors d'un retour
sur un quartier déjà parcouru. La triangulation PVP et les positions
altimétriques pré-calculées des chaussées proches sont conservées dans un
cache CPU de 6 secteurs au plus et 180 000 sommets au total, évincé LRU.
Le cache n'ajoute aucune géométrie au GPU : les secteurs hors champ
continuent d'être libérés comme auparavant. Un mouvement de caméra
annule la préparation des secteurs devenus inutiles à chaque tranche
de 48 entités, évitant de bloquer un geste tactile pour une autre zone.

L'affichage reste en 0.25. Les correctifs d'eau, parcs, ponts et relief
de la 0.25.5 sont intacts ; le maintien des FPS sur Android reste à
confirmer visuellement.

## 0.25.5 — suppression des voiles triangulaires, relief continu

Les captures Android des 5 h 44–5 h 46 le 8 novembre 2026 montrent
des triangles de centaines de mètres dans la Seine et sur la chaussée.
La cause technique est confirmée : certaines emprises d'eau IGN traversent
jusqu'à 7,7 km et les triangles issus d'earcut étaient placés en altitude
uniquement à leurs sommets. Leur interpolation plane coupait le MNT IGN
de 200 m et produisait des plages successives en avant/arrière du sol.

Les triangles sont désormais subdivisés **avant transfert GPU** avec
des milieux d'arête partagés : une seule hauteur interpolée par sommet
à une maille inférieure au terrain. Un budget strict borne leur coût
graphique. L'approche s'applique à l'eau IGN, aux routes PVP (échelle
lointaine et tuiles rapprochées), aux voies du 4e et aux parcs Paris Data.
Les couches proches disposent de priorités de profondeur cohérentes
qui évitent les doubles surfaces scintillantes.

L'échantillonnage altimétrique n'alloue plus de tableau temporaire à
chaque lecture, ce qui réduit les pauses GC pendant les chargements.
Le rendu panoramique, l'inventaire végétal, les détails architecturaux
et les fonctions de jeu sont conservés.

Cette adaptation modélise le *terrain sous les emprises*, pas le profil
hydraulique exact de la Seine ; les altitudes d'eau ne sont pas un levé
de niveaux d'eau. Ne pas présenter l'échantillonnage et les tests comme
une validation GPU Android. La montée en version 0.26 reste bloquée.

## Branche 0.25.4 — correction des pointes et lecture des collines

Les captures Android du 8 novembre ont montré de grandes « voiles »
triangulaires sur certains bâtiments et ouvrages. Les corrections
sont ciblées : les toitures IGN/LiDAR conservent leurs hauteurs propres,
mais utilisent une altitude d'assise stable par corps bâti ; les bases
de murs suivent toujours le terrain au niveau de chaque angle.
Chaque pont emploie une altitude cohérente pour son tablier et ses
parapets. Le MNT RGE ALTI à 200 m n'est pas une mesure fine des
dalles, des chaussées ni des ponts, et son interpolation ne doit
pas introduire de pente artificielle dans ces ouvrages rigides.

Une teinte graduée neutre, calculée une seule fois aux nœuds IGN,
rend les différences d'altitude plus perceptibles sans exagération
verticale, photographie ou draw call supplémentaire.

Les emprises officielles des parcs, arbres géolocalisés, eau IGN,
volumes des bâtiments, routes PVP, sélection et dossiers sont
conservés. La couverture distante et les plafonds d'instances
des versions antérieures demeurent inchangés.

Tests automatisés : contrôle de la cohérence des toitures et des
ponts avec une pente artificielle extrême, présence des couches
officielles et absence de passage prématuré en 0.26. Une validation
visuelle sur Android reste indispensable.

## Prototype 0.25.3 — relief IGN et patrimoine végétal officiel

Le relief utilise le RGE ALTI, avec une grille mesurée tous les 200 m,
sur Paris et ses environs. Les altitudes entre nœuds sont interpolées,
ce n'est pas un scan LiDAR du sol. Bâtiments et toitures simplifiées,
chaussées, ponts, eau, espaces verts et arbres partagent le même
référentiel de hauteur. La vue de rue respecte l'altitude locale.

Les parcs, jardins, espaces boisés et plantations sont représentés par
leurs emprises officielles Paris Data, avec des teintes vert-gris distinctes.
Une emprise de parc ne prouve pas que toute sa surface est engazonnée.

Les arbres géolocalisés proviennent de deux inventaires complémentaires,
sans duplication des arbres du 4e. Les couronnes sont schématiques.
Les secteurs arborés visibles sont bornés à 2/4/6 selon la qualité
et chargés au repos plutôt que pendant les gestes ; les arbres disparaissent
lorsqu'ils sont trop petits pour être visibles depuis le ciel.
Certaines hauteurs d'arbres sans mesure restent estimées.

L'eau IGN reste un seul maillage, calé sur la grille de terrain pour éviter
les intersections, sans prétendre reconstituer une cote hydrologique réelle.

La base de jeu (routes, dossiers, horloge et sauvegardes) reste intacte.
La 0.26 n'est pas autorisée avant une validation Android du relief,
des espaces verts, de l'eau et de la fluidité.

## Version 0.25.2 — correction des quartiers manquants au dézoom

Une vérification chiffrée du manifeste IGN a révélé la régression :
à 4,5 km de zoom autour du centre de Paris, la limite du nombre
d'instances de toiture ne laissait apparaître que 2 des 16 secteurs
potentiellement visibles. Aucun téléchargement ne pouvait corriger
cette lacune : il s'agissait d'un problème de répartition du budget.

La couverture lointaine utilise désormais jusqu'à 15 groupes,
avec un échantillonnage régulier d'emprises IGN réelles et au maximum
2 400 toitures par groupe, tout en conservant le plafond de 36 000
instances et les toitures composées de deux triangles. Les emprises
sont de vrais bâtiments officiels ; seules les enveloppes lointaines
demeurent simplifiées. Les détails exacts proches et l'exclusion des
doublons lors des substitutions de tuiles sont conservés.

Cette correction rend la maquette distante moins lacunaire sans
promettre un Paris exhaustif à chaque image. Le rendu du téléphone
doit encore être validé. Aucun passage en 0.26 ; réintroduction
graduelle eau/végétation à faire après confirmation.

## Version de stabilité 0.25.1 — ne pas passer à 0.26

Le rendu 0.25 constitue la base validée sur captures Android : 48 à 58
FPS, avec un réseau PVP visible. Une réserve de fichiers bruts IGN de
~3,5 Mo est désormais préchargée progressivement lorsque l'utilisateur
ne manipule pas la maquette (sauf mode économie de données). Cela réduit
les délais réseau lors d'un saut ultérieur dans un autre secteur, sans
dessiner les 287 075 bâtiments simultanément et sans saturer le GPU.

Le dernier groupe déjà présent reste affiché pendant l'arrivée des
silhouettes de la nouvelle zone. Les lourdes tuiles de précision ne sont
plus assemblées pendant la manipulation ; les petits lots de matrices
cèdent périodiquement une image au navigateur pour limiter les gels.
Le cache brut est indépendant du budget strict de groupes GPU.

Le passage en version 0.26 reste bloqué : essai Android de déplacements
dans plusieurs arrondissements nécessaire, puis intégration par étapes de
l'eau et de la végétation officielles, avec régressions vérifiées à chaque
étape. Aucune garantie impossible d'affichage instantané sur connexion
défaillante ou téléphone saturé n'est formulée.

## Prototype 0.25 — chaussées PVP dans Paris entier, performance Android

Les emprises réelles du Plan de voirie de Paris sont affichées dans toute
la capitale, et non plus uniquement dans le pilote du 4e arrondissement.
Une unique couche de chaussées simplifiées est dessinée à distance ; trois
secteurs proches (jusqu'à cinq selon la qualité) complètent les tracés exacts.
Les données proviennent des fichiers PVP déjà préparés, sans requête de
géocodage supplémentaire ni voie inventée. La couverture ne prétend pas
inclure les communes limitrophes. Les chaussées proches sont sélectionnables.

La résolution s'ajuste seulement après une chute prolongée des FPS :
une hystérésis évite le pompage pendant une rotation rapide. L'ancien
rendu neutre des bâtiments, les dossiers territoriaux, la vue de rue,
les sauvegardes et l'horloge sont conservés.

## Prototype 0.24 — voirie contrastée et premiers dossiers territoriaux

Les chaussées du 4e sont distinctes du sol, des trottoirs et des espaces
piétons par des gris neutres. La géométrie reste officielle (IGN/OSM),
les classes « avenue principale / rue secondaire » ne sont pas
inventées à partir des seules surfaces disponibles. Les chaussées deviennent
sélectionnables : la dénomination est rapprochée du répertoire officiel des
rues de Paris, et ce rapprochement approximatif est annoncé dans la fiche.

Depuis un bâtiment, une chaussée ou un lieu, le joueur peut désormais
**Observer**, **Prioriser** ou **Ouvrir un dossier**. Les dossiers apparaissent
dans « Gestion et parties » avec suivi temporel après 24 h de jeu. Il s'agit
de statuts de décision simulés, jamais de réponses administratives réelles.
Ces dossiers sont automatiquement conservés dans IndexedDB et inclus
dans les exports JSON ; les anciennes sauvegardes de schéma 1 restent
compatibles. Les bâtiments, la caméra 360°, l'horloge, les données
officielles, les budgets et le niveau de détail mobile sont préservés.

## Prototype 0.23 : palette corrigée et rendu Android stabilisé

La capture Android du 8 novembre 2026 a confirmé **60 FPS** en 0.22, mais les
sols et les chaussées apparaissaient noirs. La cause était l'association
`StandardMaterial.disableLighting=true` à une émission lumineuse quasi nulle.
Le rendu 0.23 associe dorénavant des teintes émissives calibrées à toutes les
surfaces non éclairées : sol, voirie, eau IGN et toitures distantes.

Les données officielles et les sauvegardes ne changent pas. Le budget de
géométrie LOD limitant la charge du GPU mobile est conservé. Les modules SIG
expérimentaux non actifs ont été corrigés afin de ne pas réintroduire ce défaut.

Cette correction est validée par compilation et tests automatisés ; son rendu
doit encore être confirmé sur l'appareil Android.

## Prototype 0.11 : maquette géométrique blanche et grise

Le rendu satellite, les textures, les arbres décoratifs et le cycle de
lumière ont été désactivés. L'horloge et les contrôles temporels fonctionnent.
Chaque bâtiment conserve son emprise IGN et ses subdivisions municipales
validées. L'apparence de la ville est désormais monochrome. Les toits sans
forme connue restent plats en attendant les mesures LiDAR, au lieu d'inventer
une silhouette historique.

Pour naviguer : en mode Carte, faites glisser la maquette à un doigt.
Appuyez sur 360° pour orienter librement la caméra avec un doigt; touchez
Pan pour revenir au déplacement. Deux doigts effectuent le zoom, la
rotation et l'inclinaison. Le mode Rue permet de regarder autour de soi
et d'avancer à l'aide des commandes. Les gestes sont amortis.

Le terrain, la Seine et les ponts utilisent des maillages gris; certaines
largeurs et hauteurs restent schématiques, ce qui est indiqué dans Détails.
Cette version favorise la fidélité géométrique plutôt que les textures.

# PARIS, le jeu de la ville

Prototype gratuit en 3D pour navigateur et Android. Le code est hébergé dans un dépôt GitHub public.



## Suivi de la fidélité des façades

Le dossier de recherche transmis est intégré à [la méthode détaillée](docs/FACADES_PARIS.md).
Les licences et sources en service sont inventoriées dans `data/sources/licences.json`.
Le rapport `data/quality/coverage-4e.json` différencie les matériaux et les
formes de toit documentés des façades réellement observées. À ce stade, aucune
façade n'est encore phototexturée et associée à une preuve par image.

## Navigation au niveau des rues

Le bouton Rue rapproche la caméra d'une hauteur de perspective de quelques mètres.
La vue conserve les bâtiments Babylon.js ; quatre flèches permettent de se
déplacer de manière continue. Le mode Carte reste accessible par le même bouton.
Il ne s'agit pas encore d'un système de collisions ou de promenade physique.

## Prototype 0.10 : relief architectural léger

Les façades procédurales ont désormais des ouvertures plus discrètes et
une proportion de maçonnerie plus crédible. Les couronnements de toit sont
modélisés par des volumes 3D discrets, regroupés par tuile pour limiter le
coût de rendu. Leur forme et leurs dimensions sont **illustratives**, non
mesurées. Ils ne s'affichent qu'à courte distance en Moyen/Haute.

Les 2 696 bâtiments réels et la photographie IGN restent en place à tous
les zooms. La reconstruction véritable des toitures par LiDAR est la
priorité architecturale suivante.

## Mode précision tactile 0.9.1

L'aide « ? » propose un mode précision qui réduit à 35 % la sensibilité des
gestes et ralentit les déplacements en vue Rue. Cette option applique une
méthode originale TypeScript inspirée de la précision des outils de city
builders, sans recopier leurs codes propriétaires ou leurs mods.

## Inspiration Cities: Skylines, sans imitation de sa ville fictive

PARIS suit son propre objectif : géographie réelle, bâtis documentés, compétences
réelles de la mairie et bac à sable sans niveaux. Nous étudions les méthodes
de rendu, de réseau et de mods ouverts des Cities: Skylines I et II, en
sélectionnant uniquement les composants librement réutilisables et compatibles
avec notre moteur mobile. Voir [référence technique](docs/REFERENCE_CITIES_SKYLINES.md).

## Prototype 0.9 : premiers volumes architecturaux officiels

- Le fond aérien demeure une vraie photographie IGN, mais ne remplace pas le relief 3D.
- 8 664 géométries municipales « Volumes bâtis » ont été analysées.
- 894 bâtiments IGN ont été rapprochés de 3 260 subdivisions géométriques fiables.
- Les 601 bâtiments avec au moins 90 % de couverture deviennent éligibles au rendu étagé, sauf ceux dotés de formes de toit OSM déjà documentées.
- La géométrie en plan est officielle. Les hauteurs intermédiaires sont estimées à partir des niveaux par volume et de la hauteur du bâtiment IGN.
- Les 2 696 bâtiments et la sélection restent présents à tous les zooms. Les façades photographiques et véritables toits LiDAR restent à construire.

## Prototype 0.8 : photographie aérienne et nouvelle caméra

- Aucune inscription de rue affichée.
- Glisser pour saisir la carte, pincer pour zoomer autour des doigts, tourner sans inversion, glisser deux doigts verticalement pour incliner.
- Photographies aériennes IGN BD ORTHO, Licence Ouverte 2.0, rectifiées par GitHub Actions, affichées dans la 3D Babylon.js.
- Les anciennes couches schématiques ne s'affichent qu'en secours en l'absence d'orthophotographies.
- Les façades des bâtiments restent pour l'instant des reconstitutions simplifiées.

## Correctif 0.7 : noms de voies ancrés dans la scène 3D

Les étiquettes projetées en 2D sont remplacées par des inscriptions réellement
placées sur les chaussées dans Babylon.js. Les points d'ancrage sont fixes à
tous les zooms. Un atlas de texture et un seul maillage limitent le coût GPU ;
les noms restent petits, discrets, répétés sur les longues voies et visibles
seulement à proximité. Ponts et passerelles sont placés au-dessus de leurs
tabliers schématiques. L'occlusion est traitée par le moteur 3D.

## Version 0.6 : matériaux et toitures issus de données réutilisables

Le prototype conserve 2 696 bâtiments IGN, indépendamment de la caméra et du zoom.

- 1 315 bâtiments disposent d'un matériau des gros murs déclaré dans la BD TOPO.
- 1 334 bâtiments disposent d'un matériau de toiture déclaré dans la BD TOPO.
- 2 002 bâtiments disposent d'un nombre d'étages renseigné.
- Les textures de pierre, meulière, brique, béton, bois, tuile, ardoise et zinc sont associées à ces matériaux lorsque le code cadastral est exploitable.
- Les formes de 59 toitures ont été rapprochées d'OpenStreetMap après contrôle de la correspondance des emprises avec l'IGN. Seules huit hauteurs de toiture sont renseignées par OSM. Les autres pentes sont estimées et identifiées comme telles.

Les emprises sont de vraies géométries IGN. Les matériaux décrivent la structure fiscale, qui peut différer du parement visible. Les motifs et les fenêtres sont des créations procédurales, pas des photographies de chaque façade. La forme du toit est effectivement documentée dans les 59 cas cités, mais ses proportions ne sont pas toujours mesurées.

Les futurs détails architecturaux devront être reconstitués à partir de sources ouvertes autorisant la réutilisation, en particulier LiDAR HD IGN, les 8 664 volumes bâtis du 4e publiés par la Ville de Paris et des photographies Panoramax sous licence compatible. Il est interdit d'extraire les maillages et textures protégés de Google Maps.

## Noms de rues discrets

Les voies officielles sont toujours disponibles, mais leurs étiquettes ne sont affichées
qu'à proximité. Police fixe 9 px, faible opacité, orientation sur la chaussée et répétition
sur les grandes rues. Les superpositions sont évitées pour ne pas encombrer l'écran Android.
Le zoom arrière masque les étiquettes, jamais les bâtiments.

## Version 0.5 : Paris au fil des heures

La simulation dispose d'une horloge en temps parisien et d'un cycle visuel jour et nuit.
À ×1, une journée dure 24 minutes. Les vitesses ×10 et ×60 permettent d'observer
rapidement plusieurs journées et saisons. Le ciel, la position du soleil, la
lune, les éclairages simulés et les fenêtres allumées évoluent avec la date.

Les bâtiments restent intégralement présents quel que soit le zoom ; les 205
noms de voies officiels restent affichables à toutes les heures du jeu.

Les étoiles et les lampadaires sont provisoires et stylisés, sans prétendre
à une représentation exacte des étoiles ni aux emplacements réels des luminaires.
Les horaires et décisions de la Ville ne pilotent pas encore l'éclairage :
ce raccordement fait partie du socle de simulation ultérieur.

## Version 0.4 : stabilité et repérage

- Les 2 696 bâtiments IGN du 4e sont conservés en mémoire, quelle que soit la position ou le zoom de la caméra. Les boutons + et - ne font plus varier leur présence.
- Les murs et toitures sont habillés séparément. Les motifs d'ouverture et les finitions sont procéduraux et adaptés à l'usage IGN, mais ne constituent pas des photographies ou des relevés certifiés de chaque immeuble.
- Les 205 dénominations officielles de la Ville de Paris pour le 4e disposent d'une étiquette toujours active, sans bouton pour la masquer. Les chevauchements restent possibles quand la caméra montre un territoire très vaste.
- Les liens IGN et Ville de Paris permettent de retrouver la provenance des données.

Les prochaines étapes poursuivront la vérification des matériaux et des types de toiture, l'amélioration des monuments, puis le cycle lumière et météo. Une étape est validée sur Android avant d'étendre sa complexité.

## Version 0.3 : premiers détails de la ville

- Ponts simplifiés en volume, avec tabliers et parapets. Ces volumes ne reproduisent pas encore la hauteur ni la silhouette de chaque ouvrage réel.
- Façades illustrées de fenêtres, encadrements et garde-corps par texture procédurale. Les styles et les périodes de construction individuelles ne sont pas encore attribués aux bâtiments.
- Arbres géolocalisés d'après les enregistrements de la Ville de Paris, instanciés pour limiter la charge GPU.
- Arbres lointains masqués et densité modulée par le réglage de qualité.
- Horizon progressivement fondu dans une brume légère, sans coût élevé en ombres dynamiques.
- Aucune donnée de végétation ou de patrimoine fictive présentée comme un relevé officiel.

La version 0.3 reste une étape visuelle. Le moteur d'arbre est optionnel si la ressource municipale n'est pas disponible. Les fichiers sont toujours distribués gratuitement par GitHub Pages.

## Version 0.2 : infrastructures du 4e

- Voiries, trottoirs, chemins et places issus des tracés OpenStreetMap.
- Seine, berges et tronçons de ponts issus d'OpenStreetMap.
- Largeurs de chaussée et hauteurs de tabliers schématiques lorsque les sources ne renseignent pas les cotes. Les ponts ne sont pas encore des modèles architecturaux détaillés.
- Extraction reproductible dans GitHub Actions, vérifications et chargement d'un unique fichier compact.
- Affichage de la provenance OSM dans le jeu et aide tactile réduite.

Pour obtenir les données initiales, le workflow « Préparer rues, Seine et ponts OSM » s'exécute sur GitHub. Si la source est indisponible, les bâtiments restent explorables.

## Étape 1

- Géographie pilote : le 4e arrondissement de Paris.
- Bâtiments réels de la BD TOPO IGN, extrudés selon leurs hauteurs disponibles.
- Déplacements tactiles, zoom, rotation et inclinaison.
- Sélection d'un bâtiment avec hauteur, usage et identifiant officiel.
- Trois réglages de qualité graphique et compteur FPS.
- Application Web progressive (PWA) prévue pour installation sur Android.

## Technologies

Vite, TypeScript, Babylon.js et Python pour la préparation des géométries par GitHub Actions. Aucune licence logicielle payante ni serveur privé n'est requis pour le développement.

## Vérification dans GitHub

Dans l'onglet Actions, lancer « Vérifier PARIS 3D ».
Ce workflow télécharge les données IGN si elles n'existent pas, vérifie les géométries, compile le projet et produit un paquet de site.
L'extraction IGN doit réussir avant toute validation du rendu sur Android.

Pour conserver un instantané des données officielles dans le dépôt, exécuter « Préparer les données IGN ».
En cas d'indisponibilité de l'IGN, aucun bâtiment de remplacement n'est inventé.

## Confidentialité et publication

Le dépôt est public et le jeu sera publié gratuitement avec GitHub Pages.
Pour l'activer : Settings > Pages > Build and deployment > Source : GitHub Actions.
Puis dans Actions, lancer « Publier PARIS sur GitHub Pages » via Run workflow.
Le site publié sera accessible à toute personne disposant du lien. Il ne contient pas de données personnelles du joueur.

## Documentation

- [Architecture 2.1](ARCHITECTURE.md)
- [Tests Android](TEST_ANDROID.md)
- [Crédits des données](CREDITS_DONNEES.md)

Projet indépendant, non affilié à la Ville de Paris.

## Maquette 0.12 : eau, quais, voies et limites

Palette neutre raffinée, traits de berges et limite officielle du 4e
arrondissement. Aucun retour aux photographies ni aux façades décoratives.
La maquette continue à distinguer les mesures d'emprises des largeurs
schématiques de certaines voies ou des profils de ponts.

## Premier module de gestion et sauvegardes

Le bouton € donne accès au budget de fonctionnement et d'investissement
de la Ville-département, une fois les montants récupérés depuis le jeu de
données officiel Paris Data. Aucun chiffre n'est substitué si la récupération
échoue. Une proposition budgétaire enregistrée dans le jeu n'a pas encore fait
l'objet d'un vote du Conseil de Paris.

Le panneau permet de sauvegarder plusieurs parties en IndexedDB, de charger
l'une d'elles, d'exporter et importer un fichier JSON. Les dates, les
indicateurs partagés et les propositions budgétaires sont conservés.

## Base budgétaire de référence, 2026

Les finances affichent désormais les deux sections du budget primitif
2026 voté par le Conseil de Paris. Les montants officiels votés ne sont
pas des dépenses réalisées. La dette affichée ne prétend pas être actualisée :
l'unique référence datée est au 1er janvier 2026. Les propositions du joueur
sont distinctes de la loi de finances et du vote municipal.

## Frontières administratives officielles

Les 20 arrondissements et les 29 communes limitrophes ont été déterminés
à partir de Paris Data et d'IGN ADMIN EXPRESS par intersection des frontières
en projection métrique. Leurs contours sont affichables dans la maquette.
La 3D détaillée des bâtiments reste limitée au 4e tant que les extractions
supplémentaires ne sont pas validées.

## Toitures mesurées LiDAR HD, 4e arrondissement

Le moteur privilégie maintenant des surfaces de couverture échantillonnées
sur le MNH LiDAR HD IGN lorsqu'elles sont valides. L'extraction vérifiée en
a retenu 1 051 sur 2 696 bâtiments. Les autres restent simplifiées;
les subdivisions de la Ville de Paris priment lorsqu'elles sont plus
complètes. Les détails non mesurés ne sont jamais inventés.

## Streaming progressif hors du 4e

Le pipeline SIG utilise les emprises officielles IGN BD TOPO du périmètre
complet. Le chargeur 3D optionnel affiche 6 à 16 tuiles voisines à la fois,
selon l'appareil, et ne télécharge pas toute la métropole sur Android.
Les tuiles sont chargées uniquement si le jeu de données géographiques
complet a été généré et validé. Les vues lointaines nécessitent encore
un niveau de détail général pour éviter tout trou visuel.
