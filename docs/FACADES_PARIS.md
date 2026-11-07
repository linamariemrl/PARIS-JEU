# FACADES_PARIS_SOURCES_INTEGRATION.md

**Projet : reconstitution de Paris dans un jeu mobile - dossier de sources et consignes de production**  
**État : 7 novembre 2026**  
**Cible initiale : 4e arrondissement de Paris**  
**Technologies existantes : Vite, TypeScript, Babylon.js, PWA hors ligne, GitHub Actions / Pages, Android**

## 1. Objectif et limites

Construire une représentation de chaque bâtiment de Paris selon son **emprise, ses dimensions, sa hauteur et ses éléments architecturaux documentés**. Viser une **reconstitution fidèle** des façades, et non appliquer indistinctement une façade haussmannienne générique à tous les immeubles.

Aucune source publique vérifiée ne livre un modèle 3D phototexturé, librement réutilisable et complet **de toutes les façades de tous les immeubles parisiens**. Le moteur doit donc fusionner des observations complémentaires, sans présenter une façade inférée comme strictement photographique.

- **Géométrie attestée** : emprises, volumes, hauteurs et parties en retrait ou saillie.
- **Apparence attestée** : photographie libre exploitée, renseignement patrimonial précis ou relevé de matériau disponible.
- **Apparence reconstituée** : génération à partir de règles typologiques documentées et de textures CC0, avec un niveau de confiance inférieur.
- **Inconnu** : pas de donnée suffisante ; ne pas inventer l'exactitude.

## 2. Catalogue priorisé des sources vérifiées

| Priorité | Source / lien officiel | Contenu réutilisable pour le jeu | Licence et vigilance |
|---|---|---|---|
| 1 | [Ville de Paris - Volumes bâtis](https://opendata.paris.fr/explore/dataset/volumesbatisparis/) | Forme géographique et volumes différenciés par hauteur, débords, retraits, nombre de niveaux | **ODbL** ; des volumes ne sont pas des façades phototexturées |
| 1 | [Apur - Emprise bâtie Paris](https://opendata.apur.org/datasets/Apur::emprise-batie-paris/about) ; [notice](https://www.apur.org/fr/open-data-cartes/open-data/emprises-baties-paris-metropole-une-lecture-tissu-urbain) | Période de construction/réhabilitation, hauteur, typologie de toiture (forme, couverture), catégories morphologiques et tissu urbain | **ODbL** ; types de toitures documentés, pas un inventaire exhaustif des matériaux de toutes les façades |
| 1 | [Panoramax - catalogue de photos](https://explore.panoramax.fr/) ; [documentation API](https://docs.panoramax.fr/backend/api/api/) ; [réutilisation et export](https://docs.panoramax.fr/how-to-contribute/use-panoramax/) | Photographies de rue géolocalisées, orientation, date, accès par API STAC / OGC ; base majeure pour l'observation de façades réelles | **Variable par instance et image** : par ex. IGN Etalab 2.0, OSM-FR CC BY-SA 4.0 ; enregistrer l'auteur, la licence et la source pour chaque cliché |
| 1 | [PSMV du Marais - rapport](https://regles-urbanisme.paris.fr/plu-bioclimatique/jsp/site/Portal.jsp?document_id=203&portlet_id=45) ; [partie typologies (PDF)](https://regles-urbanisme.paris.fr/plu-bioclimatique/servlet/plugins/document/resource?id=427&id_attribute=93&working_content=true) | Typologies de maisons et d'immeubles, des périodes anciennes au XXe siècle ; références visuelles et descriptives pour le 4e | Document consultable gratuitement ; **ne pas présumer que ses photographies sont libres pour redistribution** |
| 2 | [IGN - BD TOPO](https://www.data.gouv.fr/datasets/bd-topo-r) | Empreintes et attributs de bâtiments, réseaux, hauteurs ; vérification/croisement avec les volumes de Paris | Licence Ouverte / Etalab 2.0 |
| 2 | [IGN - nuages LiDAR HD](https://www.data.gouv.fr/datasets/nuages-de-points-lidar-hd) ; [MNS](https://www.data.gouv.fr/datasets/mns-lidar-hd) | Formes des couvertures, altitudes, détails de volumétrie ; à traiter **en amont**, pas sur Android | Licence Ouverte / Etalab 2.0 ; ne fournit pas les couleurs de chaque façade ni le détail de chaque fenêtre |
| 2 | [OpenStreetMap - schéma d'attributs bâtiment](https://wiki.openstreetmap.org/wiki/Key:building:*) ; [toiture](https://wiki.openstreetmap.org/wiki/Key:roof:*) | `building:material`, `building:colour`, `building:levels`, `roof:shape`, `roof:material`, `roof:colour`, `roof:levels` si renseignés | **ODbL**, information très inégale d'un bâtiment à l'autre |
| 2 | [Wikimedia Commons - Façades de Paris](https://commons.wikimedia.org/wiki/Category:Facades_in_Paris) ; [bâtiments par arrondissement](https://commons.wikimedia.org/wiki/Category:Buildings_in_Paris) | Photos détaillées pour les bâtiments remarquables, certaines adresses et éléments architecturaux | Licence **à vérifier pour chaque fichier**, avec attribution et partage dans les mêmes conditions si nécessaire |
| 3 | [Plan des matériaux et couleurs des façades - Paris 7e](https://regles-urbanisme.paris.fr/plu-bioclimatique/servlet/plugins/document/resource?id=454&id_attribute=93&working_content=true) | Carte de matériaux apparents et couleurs (pierre, enduit, brique, blanc, verre/béton) | **7e uniquement**, carte datée 2011 ; référence historique, pas données de textures prêtes à l'emploi ; droits du document à vérifier |
| 3 | [Plans cadastraux d'immeubles parisiens de 1809-1856](https://www.data.gouv.fr/datasets/plans-cadastraux-des-immeubles-de-paris-1809-1856) | Métadonnées et liens vers des plans anciens ; utile pour l'histoire du parcellaire | Licence Ouverte 2.0 pour les métadonnées ; **plans de rez-de-chaussée, pas élévations de façades**, et beaucoup de situations ont changé |
| 3 | [ambientCG](https://ambientcg.com/) ; [licence](https://docs.ambientcg.com/license/) | Textures PBR photoréalistes de pierre, enduit, brique, métal, bois, béton, sol | **CC0**, intégrables au jeu même commercial ; ne prouvent pas la matière réelle d'un bâtiment particulier |
| 3 | [Poly Haven](https://polyhaven.com/) | Textures PBR, modèles de détail, éclairages HDRI | **CC0** ; choisir les assets techniquement adaptés au mobile |

### Jeux scientifiques complémentaires - uniquement comme références tant que leurs droits ne sont pas explicitement établis

- [Paris Art Deco Facades Dataset](https://github.com/raghudeep/ParisArtDecoFacadesDataset) : exemples de segmentation (portes, vitrines, balcons, fenêtres, murs, ciel, toit). **L'absence de licence explicite vérifiée interdit d'en présumer la libre incorporation au jeu.**
- [INRIA - Exploiting Repetitions for Image-Based Rendering of Facades](https://repo-sam.inria.fr/fungraph/facade-repetitions/datasets/) : échantillons parisiens et recherche de répétitions de motifs de façade. **Vérifier les droits sur les images, le code et les modèles avant intégration ou entraînement.**

### Sources à ne pas importer telles quelles

- **Google Maps et Google Street View** : leur accès en consultation ne permet pas de récupérer massivement des images, de copier les textures ou de construire des modèles dérivés destinés à une application distincte. Référence : [conditions officielles Google Maps Platform](https://developers.google.com/maps/faq).
- **Photothèque du patrimoine francilien** : les photos standard sont proposées pour un usage **non commercial** avec crédit ; la haute définition et un usage commercial nécessitent une demande. Référence : [fiche publique](https://www.data.gouv.fr/datasets/le-patrimoine-francilien-en-images).

## 3. Pipeline de reconstruction du 4e arrondissement

### Étape A - Unifier la géométrie

1. Découper tous les jeux de données sur les limites administratives du 4e et les re-projeter dans un même système métrique, notamment EPSG:2154 pour les traitements IGN/Apur adaptés.
2. Prendre les **volumes de la Ville de Paris** comme source privilégiée des subdivisions bâties, et vérifier les bâtiments/hauteurs avec Apur, IGN et LiDAR.
3. Distinguer clairement bâtiment, corps de bâtiment, polygone volumique et segment de façade ; les 362 007 enregistrements de « volumes bâtis » recensés sur le site ne correspondent pas à 362 007 immeubles indépendants.
4. Tracer des façades par segment d'arête exposé à la rue et relier ces segments à leur bâtiment, à leur adresse et à l'axe de rue. Ne pas dupliquer les murs intérieurs entre volumes adjacents.
5. Former les murs et toitures avec les vraies hauteurs/évidements quand elles existent ; signaler les corrections estimées.

### Étape B - Enrichir les données visuelles

1. Pour chaque segment de façade, interroger le catalogue **Panoramax** dans une emprise géographique ciblée (avec pagination, date, instance et respect des modalités de l'API).
2. Conserver la géolocalisation de prise de vue, le cap, les dimensions, la date, les informations de droits et la relation avec la façade visée.
3. Vérifier l'**orientation caméra–façade**, la distance, la visibilité et les masquages (arbres, véhicules, passants) : la photo géolocalisée la plus proche n'est pas nécessairement celle du bâtiment.
4. Croiser les clichés valides avec les éléments de Wikimedia Commons et, lorsque cela aide, les descriptions du PSMV du Marais.
5. Rectifier la perspective et segmenter **sur des preuves photographiques suffisantes** les surfaces de murs, vitrages, entrées, devantures, volets, corniches et balcons ; traiter séparément les zones occultées ou non observables.
6. Employer une vraie photographie en texture seulement si elle permet un calage géométrique crédible, avec droits vérifiés ; sinon modéliser séparément la trame des fenêtres et revêtir le bâtiment d'un matériau PBR cohérent avec les données.

### Étape C - Garantir une façade spécifique plutôt que générique

Établir un enregistrement par façade, en conservant la provenance :

```json
{
  "building_id": "<identifiant_source>",
  "facade_id": "<identifiant_segment>",
  "street_name": "<rue>",
  "geometry_source": "paris_volumes_batis",
  "height_source": "apur_or_ign_or_lidar",
  "era": null,
  "wall_material": null,
  "roof_material": null,
  "roof_shape": null,
  "window_pattern": null,
  "balconies": null,
  "cornices": null,
  "evidence_urls": [],
  "image_license_records": [],
  "appearance_status": "observed|inferred|unknown",
  "confidence": "high|medium|low",
  "texture_asset": null
}
```

**Règle stricte :** `observed` exige une observation effectivement attribuable à cette façade. L'année de construction ne suffit pas à certifier le nombre de fenêtres, le matériau précis ou la couleur actuelle.

### Étape D - Production graphique fidèle et performante

- Garder **tous les volumes bâtis visibles en permanence**, quel que soit le zoom : aucun bâtiment ne doit apparaître/disparaître à cause d'un seuil de détail. Les maillages et les textures peuvent être plus simples à distance.
- Utiliser des **modules architecturaux distincts** (arches, travées, balcons en fer, balustrades de pierre, corniches, lucarnes, chiens-assis, mansardes, volets, encadrements, portes cochères, devantures), posés uniquement quand les observations le justifient.
- Employer des matériaux **PBR** (baseColor, normal, roughness, metallic si nécessaire) et des photographies redressées ; éviter les façades plates uniformément plaquées et les répétitions visibles.
- Préparer les textures **hors du téléphone** (dans une chaîne de préparation / GitHub Actions) en **atlases compressés KTX2/Basis** lorsqu'ils sont compatibles avec le moteur et les appareils visés ; limiter les variations de matériaux et les appels de dessin.
- Produire des données **par secteur/tuile**, en conservant les références légales et les métadonnées à part. Ne pas embarquer les photos sources haute définition dans le paquet Android/PWA si leurs dérivés optimisés suffisent.
- Pour le **mode hors ligne**, précharger et conserver les dalles du 4e choisies pour le prototype ; ne pas prétendre que tout Paris phototexturé puisse être livré hors ligne dans un paquet mobile de taille raisonnable.
- Conserver la contrainte existante des **noms de rues discrets** : ils n'apparaissent qu'à proximité, petits, semi-transparents, collés à la chaussée et répétés lorsque la longueur de voie le justifie ; le changement de zoom ne provoque pas de disparition du bâti.
- Mesurer les performances sur **l'unique Android de test** ; viser 30 FPS sans sacrifier l'existence des bâtiments, en dégradant d'abord la sophistication des textures et ornements lointains.

### Étape E - Livrables attendus de la chaîne

- `data/buildings/4e/` : géométries, emprises et volumes harmonisés.
- `data/facades/4e/` : segments orientés vers les rues, attributs et preuves.
- `public/assets/paris/4e/` : tuiles de maillage et textures compressées.
- `data/sources/licences.json` : origine, URL, auteur, licence, date d'accès, statut des droits de chaque photo/texture incorporée.
- `data/quality/coverage-4e.json` : nombre de bâtiments, nombre de façades, nombre de façades photographiquement attestées, reconstituées ou inconnues, erreurs de correspondance et qualité du géoréférencement.
- `docs/FACADES_PARIS.md` : méthode, sources et limites de vérité visuelle.

## 4. Consigne prête à copier dans un agent de développement

> Pour notre jeu Paris en PWA Vite/TypeScript/Babylon.js, utiliser ce dossier comme cahier des charges. Commencer par le 4e arrondissement, sans réécrire le moteur ni supprimer les données existantes. Construire une chaîne de préparation gratuite, reproductible et compatible avec un dépôt GitHub public : volumes bâtis de Paris + emprises Apur + BD TOPO / LiDAR IGN + photographies Panoramax dûment licenciées + quelques photographies Wikimedia. Les documents PSMV du Marais servent à décrire fidèlement les types architecturaux mais leurs photos ne deviennent pas automatiquement des textures libres. Chaque bâtiment doit conserver son emplacement et sa géométrie attestés ; chaque façade doit être associée à ses sources, son degré de confiance et son statut « observée / reconstituée / inconnue ». Ne pas utiliser de données Google Maps ou Street View pour créer des modèles ou textures dérivés. Ne pas modifier les règles déjà approuvées : volumes toujours présents quel que soit le zoom ; noms de rues discrets et proches ; performance Android et possibilité de fonctionnement hors ligne pour les secteurs préparés. Avant toute prétention au photoréalisme exhaustif, produire un rapport de couverture du 4e arrondissement et montrer des façades précises confrontées à leurs photos sources. Dédupliquer les géométries, préparer les textures hors téléphone, compresser les assets et documenter toutes les licences.

## 5. Point juridique et vérification avant publication

- Licence ouverte 2.0 : attribution généralement requise.
- ODbL : créditer les sources et respecter les obligations spécifiques aux bases de données dérivées publiquement exploitées ; **la licence n'oblige pas par elle-même à publier tout le code du jeu en open source**. Voir [résumé officiel](https://opendatacommons.org/licenses/odbl/summary/index.html).
- Panoramax et Wikimedia : garder la **licence propre à chaque image** ; une photo CC BY-SA peut imposer un partage à l'identique de l'œuvre adaptée sous les conditions de cette licence. Vérification spécifique si des images sont assemblées ou transformées.
- Les documents municipaux, même consultables gratuitement, ne confèrent pas nécessairement tous les droits sur les **photographies et cartes qu'ils contiennent**.
- Aucune façade « exacte » ne peut être garantie lorsque seules la forme, l'âge ou la famille architecturale sont connus.

**Statut du présent fichier :** dossier de sources et spécifications de mise en œuvre. Aucun téléchargement massif, aucune conversion de façade et aucune intégration au dépôt GitHub n'ont été exécutés par la seule création de ce document.
