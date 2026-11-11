# R12 — Première prévisualisation géométrique issue de cotes d'archives

**PR #1 du dépôt `linamariemrl/PARIS-JEU` (héritée de la PR #14 du dépôt source), branche de travail uniquement — aucune fusion, aucun changement
de la version publique 0.26.4.**

## Ce qui est réellement visible

Une **prévisualisation mobile et interactive** du relevé de la XIVe assise
du corps central Boccador, façade de l'Hôtel de Ville côté place (dessin
d'exécution de **1878**, cote d'archive `CC64_PL34`).

- **30 segments historiques transcrits**, conservés dans l'ordre du dessin ;
- deux chaînes fermées arithmétiquement : **29,45 m** et **26,05 m** ;
- longueur documentée des chaînes réunies : **55,50 m** ;
- hauteur déclarée de cette assise : **0,42 m** ;
- couleur unique des surfaces : **beige `#DED0B9`** ;
- déplacement latéral, choix d'un segment et zoom pour contrôler
  le rapport métrique entre trumeaux, travées et parties non identifiées.

**Ce n'est PAS une reconstitution 3D certifiée de l'Hôtel de Ville** :
un ruban géométrique de l'assise représente uniquement les deux
dimensions mesurées sur le document historique. Sa profondeur n'est pas
déduite, son altitude NGF et son orientation ne sont pas établies,
et sa géométrie **n'est pas affichée sur les bâtiments actuels**.

La somme des cotes correspond à la longueur transcrite, mais cela ne
démontre pas la conformité du dessin au bâtiment actuel, ni la nature
de chaque « travée » à cette assise. Les vues obliques ne doivent pas
être confondues avec une vraie photogrammétrie.

## Emplacement et consultation

- Preuve structurée : `public/data/metropole/architecture/measurements/PA00086319-boccador-assise14-proof.json`
- Aperçu HTML autonome (CSS/JS/données intégrées, sans serveur, ni service
  d'imagerie) : `public/previews/hotel-de-ville-assise1878.html`
- Source de référence d'origine : `public/data/metropole/architecture/measurements/PA00086319.json`
- Contrôle automatique : `tests/test_architecture_segment_preview_r12.py` ;
  compare strictement les segments à la source et vérifie que
  la géométrie n'est pas déclarée géoréférencée.
- Workflow spécifique **`Aperçu architectural de la PR — Hôtel de Ville 1878`**
  : archive `PARIS-Apercu-Hotel-de-Ville-1878` téléchargeable
  depuis GitHub Actions, sans publier sur GitHub Pages.

**Accès à l'aperçu autonome sur le dépôt actuel** (ni déploiement,
ni prévisualisation du jeu complet) :

**Fichier actuel dans PARIS-JEU :**
https://github.com/linamariemrl/PARIS-JEU/blob/claude/practical-archimedes-n57pkx/public/previews/hotel-de-ville-assise1878.html

**Prévisualisation téléchargeable :**
https://github.com/linamariemrl/PARIS-JEU/actions/workflows/architecture-preview-pr.yml

La vue GitHub montre le fichier source HTML ; pour l'ouvrir directement en navigateur, récupérer l'artefact `PARIS-Apercu-Hotel-de-Ville-1878` depuis le workflow, sans publication du jeu.

Aucune version publique nouvelle n'a été déployée.

## Étape réellement bloquante pour la façade 3D actuelle

1. Identifier un point d'appui actuel permettant de rattacher le
   plan de 1878 au système EPSG:2154 et à l'altimétrie.
2. Vérifier la géométrie des assises et les baies à partir de vues
   photographiques **multi-vues sous licences ouvertes** et de plans
   d'élévation cotés ; relever la date et l'état du monument.
3. Produire un modèle 3D avec profondeur, altitude, position et
   incertitude **mesurées**. Faute de mesures, aucun segment de
   façade supplémentaire n'est déclaré réel.
4. Repasser les verrous de certification de `architectureModels.ts`,
   comparer les prises de vue, puis soumettre une preview du modèle
   dans le moteur réel. Ne pas passer outre le verrou de dossier
   `publicationAllowed=false`.

Ce premier lot livre donc une **preuve visuelle de segmentation
documentaire**, pas la maquette monumentale réclamée : le statut
reste `drawing-local-unregistered`.

**Jeu public inchangé :**
https://meyameya677-sketch.github.io/Paris-le-jeu/
