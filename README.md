# PARIS, le jeu de la ville

Prototype gratuit en 3D pour navigateur et Android. Le code est hébergé dans un dépôt GitHub public.



## Suivi de la fidélité des façades

Le dossier de recherche transmis est intégré à [la méthode détaillée](docs/FACADES_PARIS.md).
Les licences et sources en service sont inventoriées dans `data/sources/licences.json`.
Le rapport `data/quality/coverage-4e.json` différencie les matériaux et les
formes de toit documentés des façades réellement observées. À ce stade, aucune
façade n'est encore phototexturée et associée à une preuve par image.

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
