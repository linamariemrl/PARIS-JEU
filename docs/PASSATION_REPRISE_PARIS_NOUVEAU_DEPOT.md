# PARIS — Passage au dépôt REPRISE-PARIS

**Décision du propriétaire :** la nouvelle destination de l'ensemble du travail est
https://github.com/linamariemrl/REPRISE-PARIS.

Source historique : https://github.com/meyameya677-sketch/Paris-le-jeu

Branche de développement complète : `claude/practical-archimedes-n57pkx` ;
PR source : https://github.com/meyameya677-sketch/Paris-le-jeu/pull/14.
Dernier HEAD de référence **avant préparation de ce transfert** :
`6ad8811053ad86ead12893efac95a90be36298b5`.
Toujours revérifier le HEAD actuel : les sauvegardes doivent utiliser la
dernière version, sans effacer les commits de Claude ou ChatGPT.

## Accès au nouveau dépôt

Au contrôle initial du 11 novembre 2026, **les deux connexions GitHub de
ChatGPT renvoyaient 404** pour `linamariemrl/REPRISE-PARIS`. Cette réponse
n'établit pas que le dépôt n'existe pas : il peut être privé ou **non autorisé**
dans l'installation GitHub utilisée par ChatGPT.

**Tant que l'accès n'est pas établi, le transfert ne doit jamais être déclaré
effectué.** Ne pas tenter de mettre un jeton personnel dans le code,
les commentaires, les sorties du workflow ou les archives.

## Sauvegarde portable créée automatiquement sur la PR source

Le workflow `.github/workflows/paris-handover-backup.yml` prépare un
artefact GitHub Actions nommé `PARIS-passation-integrale`, contenant :

- **`PARIS-historique-complet.bundle`**, bundle Git contenant l'historique
  et les références récupérées des branches/tags du dépôt source ;
- **`PARIS-etat-branche-PR14.zip`**, instantané des fichiers de la branche
  de développement, y compris code, données versionnées, documentation
  et scripts ;
- un manifeste de vérification comprenant HEAD, taille, SHA-256 et
  provenance des deux éléments ;
- les commentaires de la PR source exportés en JSON Lines, lorsque
  l'API GitHub autorise la lecture, afin de préserver les décisions R01–R12.

Un bundle Git n'inclut pas automatiquement les issues, commentaires
ou paramètres du dépôt GitHub. Le ZIP d'état n'inclut pas l'historique :
les deux complètent la sauvegarde.

## Reprise dans le nouveau dépôt, après autorisation du connecteur

1. Vérifier l'accès en écriture à `linamariemrl/REPRISE-PARIS` depuis
   la **connexion GitHub `linamariemrl`**.
2. Inspecter `main` et toute branche existante du nouveau dépôt :
   **ne pas écraser son contenu ni forcer un push**.
3. Importer la branche source complète avec son historique Git
   dans `reprise-integrale` du nouveau dépôt.
4. Vérifier le contenu (code, scripts, assets, dossiers de passation),
   les fichiers volumineux, la cohérence des hashes et le fonctionnement
   des suites de tests/compilation.
5. Transcrire les décisions et la situation actuelle de la PR #14
   dans une note de passation du nouveau dépôt, avec liens vers les
   commentaires source.
6. Ouvrir au besoin une PR **brouillon** `reprise-integrale → main`
   du nouveau dépôt, pour éviter toute fusion ou publication involontaire.
7. Corriger séparément la configuration des chemins GitHub Pages
   (`Paris-le-jeu` et `REPRISE-PARIS` diffèrent), la CI, l'APK et les
   paramètres propres à l'organisation, **avant tout déploiement**.

L'ancien site public
https://meyameya677-sketch.github.io/Paris-le-jeu/
doit rester disponible et inchangé. Le nouveau dépôt n'est pas
automatiquement une nouvelle URL jouable.

## Règles historiques toujours applicables

- Monuments identifiés : **beige unique `#DED0B9`** ; aucun code couleur
  par fonction.
- Architecture : vraies mesures, plans et photos libres multi-vues,
  pas de façades inventées ; IGN utilisé comme référence spatiale.
- Préserver inventaire patrimonial, fiches Histoire, jeu municipal, 80
  quartiers, données 3D, scènes, sauvegardes, séquences R09–R12,
  PARIS Matières M0/J1 et aperçu historique de l'Hôtel de Ville.
- **Ne pas fusionner, changer de version publique, ni annoncer 0.27
  sans validation du propriétaire.**

Ce document est une **notice de migration**, pas la preuve que le nouveau
dépôt a reçu le code.
