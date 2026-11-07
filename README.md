# PARIS, le jeu de la ville

Prototype gratuit en 3D pour navigateur et Android. Le code est hébergé dans un dépôt GitHub public.

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
