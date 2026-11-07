# PARIS, le jeu de la ville

Prototype gratuit en 3D pour navigateur et Android. Le code est hébergé dans un dépôt GitHub public.

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
