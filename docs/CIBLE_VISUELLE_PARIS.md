# PARIS — direction de rendu visuel à terme

**Références de décision :** les deux images de rendu partagées par l'utilisateur dans la conversation du 8 novembre 2026. Elles donnent la direction artistique recherchée, **et non un rendu déjà atteint ni une autorisation d'ajouter des vues satellites**.

## 1. Objectif d'ensemble

Passer progressivement de la maquette fonctionnelle blanc-gris 0.26 à une ville 3D cohérente et détaillée, sans sacrifier la navigation mobile ni l'identité réelle des rues et bâtiments de Paris. Les volumes, les proportions, les silhouettes des monuments et la continuité de la ville priment sur la décoration. Le niveau de détail augmente avec la proximité de la caméra ; pas de changement brutal de géométrie ni de disparition des bâtiments au déplacement.

### Ordre non négociable de fidélité

1. **Données vérifiées :** emprise, hauteur, relief, placement, volumétrie, cours, divisions internes lorsque documentées (IGN BD TOPO, LiDAR HD, Ville de Paris, POP, géométrie OSM qualifiée).
2. **Forme et architecture :** toitures exactes ou contrôlées, combles, coupoles, tours, ailes, portiques, arcades, corps de bâtiments, escaliers extérieurs quand les relevés les établissent. Les géométries LiDAR mesurées restent prioritaires ; les approximations OSM doivent être identifiées comme telles.
3. **Paysage urbain :** chaussées, places, parcs, squares, fontaines et bassins, alignements et essences d'arbres lorsqu'elles sont cartographiées ; plans de sols sans trous ou secteurs noirs.
4. **Rendu final :** matériaux et détails sobres et cohérents ; effets d'ombre et lumière réalistes, pas de textures photographiques ou satellites importées arbitrairement. La possibilité d'enrichir visuellement la scène ne vaut jamais preuve de la matière des murs ou des toitures.
5. **Confort de jeu :** 360°, panoramiques, zoom et déplacement doivent rester fluides ; les données et les fiches sont chargées de manière indépendante du rendu.

## 2. Hiérarchie des objets

- **Culturels et touristiques :** beige pierre discret, avec silhouette spécifique quand documentée.
- **Politiques et administratifs :** orange léger, uniquement si la destination est attestée, sans changer artificiellement les matériaux du sol.
- **Financiers :** bleu léger, fonction historique et fonction actuelle explicitement séparées.
- **Bâtiments ordinaires :** gamme neutre ; fiches très courtes contenant l'adresse vérifiée et l'histoire documentée du quartier.
- **Rues, places, jardins, parcs, squares, ponts, cours et équipements :** sélection par géométrie quand elle existe. Aucune désignation de rue à partir d'un point voisin présentée comme certaine.

Chaque objet doit pouvoir être sélectionné depuis toute sa surface 3D ou depuis son emprise cartographique reconnue, avec priorité à l'objet le plus spécifique sous le point touché. Une localisation non attestée reste décrite comme approximation.

## 3. Feuille de progression graphique

**Phase A — fondations et données (0.26.x) :** lieux et fiches universelles, enrichissement de la base historique à chaque version, découpage des couches en tuiles et chargement anticipé, modèle couleur par fonction, réparation des artefacts.

**Phase B — monuments prioritaires :** inventaire des monuments et ensembles, audit individuel des formes, maillages précis pour coupoles/toits/ailes/pignons/volumes remarquables, clic sur toute l'emprise, fiches historiques synthétiques sourcées.

**Phase C — tissu urbain :** continuité des façades et toitures documentées, espaces publics, urbanisme du 1er au 20e, bois et communes limitrophes incluses selon le périmètre couvert ; objets et mobilier urbains seulement s'ils sont localisés.

**Phase D — finition :** matériaux qualitatifs sans fiction documentaire, éclairages et ombres optimisés, transitions de niveaux de détail imperceptibles, végétation naturalisée, rendu d'ensemble visant les références visuelles de l'utilisateur.

## 4. Critères de vérification

- Aucun quartier vide ou bâtiment supprimé artificiellement pour gagner des FPS.
- Aucun plan satellite, photographie aérienne ou texture photo recollée au sol sans nouvelle décision explicite de l'utilisateur.
- Des lignes architecturales, non seulement une couleur de revêtement : les monuments doivent **avoir les bonnes formes**.
- Les détails absents d'une source sont signalés comme non documentés, et non inventés.
- Continuité lors des rotations 360° ; décodeurs et gros travaux GPU étalés après les gestes.
- L'appareil Android de l'utilisateur et ses captures restent la vérification finale. **Objectif** : navigation généralement à 30 FPS ou davantage en qualité moyenne, sans longues chutes vers les 13 FPS déjà observés ; à mesurer, pas à déclarer atteint.
- Chaque version doit accroître les références historiques et corriger des anomalies de géométrie, et pas seulement faire avancer un numéro.

## 5. Avancement et réserves

La version 0.26.x est une **maquette interactive documentée**, pas encore le rendu des images de référence. Ce cahier des charges ne vaut pas validation de photoréalisme, de synchronisation des sauvegardes, ni d'exhaustivité des objets. Le passage à une fidélité supérieure doit être réalisé par étapes, avec contrôle de performance à chaque livraison.

## 6. Arbitrage de production — fluidité d'abord (8 novembre 2026)

Accord explicite de l'utilisateur : **ne pas poursuivre le photoréalisme à
tout prix**. Le projet vise le meilleur rendu 3D vectoriel et documenté
possible dans le moteur actuel, mais **n'a pas à reproduire la photogrammétrie
de Google Earth**. Cet objectif n'est pas garanti avec les ressources
disponibles et n'est pas un critère bloquant pour le jeu.

Priorités désormais ordonnées :
1. Stabilité et continuité : éliminer les trous, les ruptures LOD, les
   disparitions momentanées, et les charges GPU lors des gestes.
2. Fluidité tactile Android : déplacements, zooms, rotations à 360°,
   affichage de la ville et des arbres sans pauses répétées.
3. Fidélité mesurée des monuments majeurs, rendue avec les données et
   géométries existantes (IGN, LiDAR, référentiels officiels).
4. Fiches courtes sourcées, rues, adresses, places, squares, parcs et
   autres lieux sélectionnables ; aucune fausse précision.
5. **Contenu du jeu**, sans attendre une hypothétique finition
   photoréaliste : institutions, interactions municipales, décisions,
   événements, progression, finance et sauvegardes.

Avant chaque évolution graphique coûteuse, mesurer son impact sur la
navigation mobile. Si elle détériore la fluidité, choisir la version
simplifiée. Ne pas modifier la palette ou ajouter des textures photo
pour masquer une géométrie ou un niveau de détail manquant.

## Hôtel de Ville — première tranche jouable (0.26.3)

- Catalogue de 32 projets simulés dans 28 domaines de gestion.
- Création de dossiers, instruction, inscription au Conseil de Paris fictif,
  vote de 163 sièges fictifs, adoption/rejet et suivi des travaux dans le
  temps de jeu. Le vote fictif n'est pas celui des conseillers réels.
- Deux enveloppes de programmation municipales purement fictives (investissement
  et fonctionnement), séparées des montants du budget officiel publié.
- Partenaires réels identifiés ; les compétences de l’État, de la région,
  d’Île-de-France Mobilités et d'autres organismes ne sont pas usurpées.
- Un projet de démolition ne modifie pas automatiquement les bâtiments
  IGN et n'autorise pas de démolir un monument protégé.
- Simulation de mobilité agrégée par 80 quartiers (indices relatifs fictifs,
  base 100, pas de vraies fréquentations ni véhicules/personnes 3D) ;
  aucun calcul coûteux n'est ajouté à chaque image.
- Sauvegardes v1 antérieures compatibles avec le champ municipal facultatif.

Prochaines phases : permissions et patrimoines fonciers individuels, achats,
consultation publique, commissions et amendements, budgets pluriannuels,
demandes des citoyens, flux et réseaux spatialisés calibrés sur observations
anonymisées officielles, services et agents, conséquences intersectorielles.
