# R14 — Hôtel de Ville : premier corpus de vues ouvertes et contrôle de calibration

**Statut : documentaire et technique uniquement.** La PR n° 1 du dépôt
`linamariemrl/PARIS-JEU` est la branche de développement. Ni le jeu public,
ni `main`, ni le fichier d'index des maquettes n'ont été modifiés par R14.

## Résultat vérifiable

Le fichier
[`PA00086319-open-views-r14.json`](../public/data/metropole/architecture/evidence/PA00086319-open-views-r14.json)
recense **8 documents distincts** : un plan historique daté de 1878 et
**7 photographies réelles**, dont **3 de 2026**, couvrant les façades ouest,
nord, est et sud. Ce sont des documents
d'entrée pour une photogrammétrie ultérieure : **0 caméra calibrée,
0 correspondance métrique validée, 0 segment 3D triangulé**.

Les fichiers photographiques ne sont ni copiés, ni modifiés, ni intégrés
au jeu. Le manifeste ne conserve que des métadonnées et des liens vers
les pages sources. Une licence autorisant la réutilisation ne garantit
pas que deux photographies ont assez de recouvrement et de parallaxe
pour une reconstruction SfM/MVS.

| Référence | Date | Angle renseigné | Licence indiquée par la source | Repère spatial |
| --- | --- | --- | --- | --- |
| [BHdV CC64_PL34](https://bibliotheques-specialisees.paris.fr/in/imageReader.xhtml?ark=73873%2Fpf0000712758%2F0034%2Fv0001.simple.selectedTab%3Drecord.hidesidebar&id=ark%3A%2F73873%2Fpf0000712758%2F0034&selectedTab=record&updateUrl=updateUrl) | 1878 | Plan XIVe assise, corps central | Domaine public (notice de la BHdV) | Aucune pose actuelle |
| [Hôtel de Ville, Paris, France](https://commons.wikimedia.org/wiki/File:H%C3%B4tel_de_Ville,_Paris,_France.jpg) | 27 juin 2026 | Façade ouest | CC0 1.0 | Coordonnées de caméra publiées, orientation inconnue |
| [Façade, août 2026](https://commons.wikimedia.org/wiki/File:H%C3%B4tel_de_Ville_de_Paris_-_Fa%C3%A7ade_-_Ao%C3%BBt_2026.jpg) | 6 août 2026 | Façade ouest | CC BY-SA 4.0 | EXIF publiées ; coordonnées et pose inconnues |
| [Détail de façade](https://commons.wikimedia.org/wiki/File:H%C3%B4tel_de_Ville_de_Paris_d%C3%A9tail_fa%C3%A7ade.jpg) | 14 juillet 2012 | Entrée principale, détail | CC0 1.0 | Coordonnées de caméra publiées, orientation inconnue |
| [Hôtel de ville - Paris](https://commons.wikimedia.org/wiki/File:H%C3%B4tel_de_ville_-_Paris.jpg) | 15 mai 2012 | Vue sud-ouest | CC BY-SA 3.0 | Coordonnées d'objet, **pas** position caméra attestée |
| [Façade nord, mai 2026](https://commons.wikimedia.org/wiki/File:H%C3%B4tel_Ville_-_Paris_IV_(FR75)_-_2026-05-30_-_1.jpg) | 30 mai 2026 | Nord | CC BY-SA 4.0 | Coordonnées caméra et cap indicatif publiés, mais **pose 3D non calibrée** |
| [Rue de Lobau, façade est](https://commons.wikimedia.org/wiki/File:P1270262_Place_St-Gervais_rue_de_Lobau_hotel_de_ville_rwk.jpg) | 9 août 2014 | Est | CC BY-SA 4.0 | Position caméra non attestée |
| [Vue depuis la Seine](https://commons.wikimedia.org/wiki/File:Paris_town_hall_Seine.jpg) | 9 avril 2011 | Sud | CC0 1.0 | Coordonnées caméra publiées, pose 3D inconnue |

**Licences :** attribution, indication des modifications et partage à
l'identique à examiner fichier par fichier avant l'incorporation de données
dérivées sous CC BY-SA. La vérification des pages a été effectuée
le 11 novembre 2026 ; revérifier avant toute réutilisation commerciale.

## Interprétation géométrique

La présence de photographies sous plusieurs angles **ne suffit pas** à
disposer de prises de vue exploitables. La précision attendue du moteur
nécessite des points homologues identifiés dans au moins deux vues, des
intrinsèques et extrinsèques calibrées, des images qui se recouvrent et
une échelle reliée à une mesure **actuelle** indépendante.

Le plan CC64_PL34 (1878) contient 30 segments et deux chaînes cotées
de 29,45 m et 26,05 m, mais **ni l'orientation actuelle, ni l'altitude,
ni la profondeur de la façade ne sont déterminées**. Les deux candidats
de tourelle du fichier `registration/PA00086319.json` ne sont PAS des
points d'appui mesurés. Aucun ajustement Lambert-93 ne peut être
présenté comme acquis à partir de ces seuls renseignements.

À obtenir, dans cet ordre :
1. Vérifier manuellement l'identité du bâti et la correspondance
   de détails conservés entre 1878 et 2026.
2. Répertorier les points homologues effectivement visibles dans
   des photographies dont les angles procurent une parallaxe suffisante.
3. Calibrer l'appareil (intrinsèques/extrinsèques), proposer un nuage
   photogrammétrique **non certifié** avec erreurs reproductibles.
4. Identifier au moins deux points d'appui **réellement mesurés**
   EPSG:2154, plus un contrôle indépendant ; mesurer aussi
   l'altitude NGF de l'assise avant une insertion géographique.
5. Vérifier les erreurs de reprojection et les résidus sur le contrôle
   indépendant, puis appliquer le vérificateur `checkRegistration`
   et les contrôles d'emprise avant d'autoriser une partie de modèle.
6. N'appliquer que le matériau beige unique `#DED0B9` aux segments
   patrimoniaux ; jamais les couleurs des photos à la maquette.

## Validations automatiques

```bash
python scripts/review_architecture_sources_r14.py
python -m unittest discover -s tests -p 'test_architecture_sources_r14.py' -v
```

La vérification rejette : sources fermées, attribution manquante, faux
appareils calibrés, coordonnées impossibles, correspondances annoncées
sans mesure, duplications et inscription anticipée d'un modèle dans
l'index. Une réponse « sources-documented-not-triangulated » est un
**résultat attendu**, pas une certification.

Ce contrôle est intégré à
`.github/workflows/architecture-validation.yml` sur la branche de la PR.
Les scripts ne téléchargent rien, ne modifient aucun modèle du jeu et
n'exécutent pas de reconstruction imaginaire.

**Jeu public conservé :** https://meyameya677-sketch.github.io/Paris-le-jeu/
