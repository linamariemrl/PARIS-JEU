# PARIS - ARCHITECTURE TECHNIQUE ET FONCTIONNELLE

**Version :** 2.1 - 07/11/2026  
**Statut :** spécification du projet gratuit, avec étape 1 implémentée en fichiers sources et préparation IGN automatisée à valider dans GitHub Actions. Le cahier initial intégral et la suite du complément transports ne figurent pas dans les messages actuellement disponibles ; aucune clause non reçue n'est inventée.  
**Objectif :** simulation municipale en bac à sable pur, sur mobile et navigateur, avec Paris et toutes ses communes limitrophes en 3D, ville vivante, gouvernance réaliste et simulation modulaire.

## 1. Principes non négociables

- Aucune histoire, aucun niveau, aucun déblocage. Toutes les politiques sont accessibles dès le démarrage ; seules les contraintes financières, juridiques, politiques et opérationnelles limitent les décisions.
- Le joueur incarne le maire de Paris, **pas** le maire des communes limitrophes. Les décisions qui ne relèvent pas de Paris passent par concertation, négociation ou convention avec les institutions compétentes.
- Représentation 3D sur l'intégralité de Paris, **bois de Boulogne et de Vincennes inclus**, et sur chaque commune partageant une frontière administrative avec Paris, dans une qualité de conception équivalente, avec adaptation dynamique du niveau de détail.
- **Cible de rendu : au moins 30 FPS** sur appareils mobiles récents suivant un protocole de mesure explicite ; priorité à la fluidité et à la lisibilité si un effet graphique doit être simplifié.
- Un seul état de simulation déterministe, composé de modules autonomes interopérables via un schéma d'indicateurs communs. Le rendu est une projection de cet état ; il ne doit pas calculer seul les règles de gestion.
- Distinction permanente entre **donnée observée, donnée reconstruite, estimation et pure simulation**, avec provenance, millésime et licence.

## 2. Architecture en couches

```text
Sources ouvertes (IGN/BD TOPO, ADMIN EXPRESS, IDFM GTFS, OSM, INSEE, données parisiennes)
    -> ingestion, attribution des licences, validation, reprojection, fusion, enrichissement
    -> tuiles 3D / graphe multimodal / référentiels géographiques / calendriers
    -> GitHub Pages : socle statique compact, sans CDN payant
    -> PWA : service worker, Cache Storage et futurs paquets locaux sélectifs

Application progressive installable (PWA), Vite + TypeScript, UI en français
    UI tactile & couches thématiques
    Babylon.js (moteur 3D et interaction/picking)
    Caméra et TileManager (chargement / mémoire / LOD)
    RenderBridge (interpolation entre simulation et rendu)
    SimulationCore (horloge, règles, transactions, événements)
    Modules indépendants (finance, mobilité, logement, climat, etc.)
    GeoRegistry / InstitutionalAuthorityRegistry / IndicatorStore
    À partir de l’étape 4 : SaveStore (IndexedDB, plusieurs sauvegardes, export/import)

Workers : simulation agrégée, recherche d'itinéraires, décodage des tuiles
Tests : exactitude SIG, cohérence métier, charge 3D, sauvegardes, mobiles réels
```

La logique métier n'appelle jamais directement Babylon.js. Les modules publient des événements typés et mettent à jour l'état par transactions contrôlées. Les actifs, personnes et véhicules visibles sont des représentations d'entités simulées, et non des sources autonomes de vérité.

### Contrats du futur moteur de simulation (à partir de l’étape 4, pas dans le pilote)

```ts
interface SimulationModule {
  id: string;
  schemaVersion: number;
  init(ctx: ModuleContext): Promise<void>;
  tick(ctx: TickContext): void;
  actions(): ReadonlyArray<ActionDefinition>;
  serialize(): unknown;
  migrate(previousVersion: number, data: unknown): unknown;
}
interface DecisionAuthority {
  policyId: string;
  leadAuthorityId: string;
  requiredApprovals: string[];
  consultativeActors: string[];
  legalBasis: string;
  validFrom: string;
  validUntil?: string;
}
interface SpatialIndicator {
  indicatorId: string;
  spatialId: string; // arrondissement, quartier, IRIS/îlot, commune voisine, territoire
  gameTime: string;
  value: number;
  unit: string;
  provenance: 'official' | 'derived' | 'estimated' | 'simulated';
}
```

Les unités spatiales possèdent des identifiants stables et des liens hiérarchiques. Une commune voisine **ne doit jamais être agrégée** dans un arrondissement parisien. Distinguer îlots urbains, IRIS statistiques et quartiers administratifs ; ne pas considérer ces découpages interchangeables.

## 3. Périmètre et données SIG

### 3.1 Emprise officielle

Les **20 arrondissements géographiques de Paris** demeurent représentés ; les **17 conseils d'arrondissement ou secteurs** reflètent le regroupement des 1er à 4e dans Paris Centre. Paris, y compris ses deux bois, est le périmètre gérable. Les communes limitrophes sont des acteurs autonomes **rendus en 3D au même standard visuel** : population, logement, emploi, congestion, budget, exécutif et couleur politique, décisions et négociations à l'échelle métropolitaine.

**Liste de contrôle issue de la liste officielle publiée par la Ville de Paris** (29 communes ; ne pas substituer cette liste au calcul des frontières IGN) :

Aubervilliers ; Bagnolet ; Boulogne-Billancourt ; Charenton-le-Pont ; Clichy ; Fontenay-sous-Bois ; Gentilly ; Issy-les-Moulineaux ; Ivry-sur-Seine ; Joinville-le-Pont ; Le Kremlin-Bicêtre ; Les Lilas ; Le Pré-Saint-Gervais ; Levallois-Perret ; Malakoff ; Montreuil ; Montrouge ; Neuilly-sur-Seine ; Nogent-sur-Marne ; Pantin ; Puteaux ; Saint-Cloud ; Saint-Denis ; Saint-Mandé ; Saint-Maurice ; Saint-Ouen-sur-Seine (Saint-Ouen dans la liste de la Ville) ; Suresnes ; Vanves ; Vincennes.

**Règle impérative de production :** figer un millésime `ADMIN EXPRESS COG` ou `ADMIN EXPRESS` de l'IGN, identifier Paris (code INSEE 75056), calculer la longueur de frontière **partagée** (et non la proximité des centroïdes ou le seul contact par un point), y compris sur les limites extérieures des bois. Tester les géométries en EPSG:2154 après correction topologique, réconcilier les noms via codes INSEE, enregistrer les éventuels écarts à la liste de référence et les examiner. Ne pas utiliser un tampon arbitraire comme critère définitif de voisinage ; documenter une tolérance géométrique uniquement pour les erreurs de précision. Exporter le résultat reproductible `communes_limitrophes.geojson` + manifeste de provenance. **Le calcul géométrique IGN n'a pas été exécuté dans la présente révision documentaire : validation avant production obligatoire.**

À l'intérieur de Paris et des communes limitrophes, déplacement sans limite artificielle, toutes les tuiles disponibles par streaming. Au-delà, région d'arrière-plan simplifiée, non interactive, chargée progressivement ; aucun mur visible, mais un éloignement hors zone simulée peut limiter les interactions et les détails.

### 3.2 Sources et ingestion

| Donnée | Source prioritaire | Usage / vigilance |
|---|---|---|
| Frontières, communes, arrondissements | IGN ADMIN EXPRESS COG, INSEE COG | géométries de référence et codes ; validation de l'adjacence |
| Bâtiments et hauteurs | IGN BD TOPO | emprises, hauteur si présente ; dates/styles pas systématiquement disponibles |
| Voirie, chemins, pistes cyclables, berges | OpenStreetMap + référentiels officiels pertinents | topologie, modes autorisés, voies, accès ; vérifier complétude |
| Arrêts, lignes, horaires théoriques | Île-de-France Mobilités PRIM/GTFS | `routes`, `trips`, `stops`, `stop_times`, `frequencies`, `shapes`, `calendar` ; service réel différent de l'offre prévue |
| Réseau ferré et souterrain | IDFM + OSM + données d'exploitants lorsqu'existantes | profondeur et tracés exacts souvent indisponibles : géométrie schématique signalée |
| Population et socio-économie | INSEE, Ville de Paris, collectivités voisines | millésimes, granularités et droits |
| Eau, relief, végétation, bâtiments remarquables | IGN, OSM, données municipales et actifs créés | qualité progressive et attribution des sources |
| Jours fériés, vacances scolaires | Sources institutionnelles annuelles | calendrier historique, année et zone C |

Les données IGN, OSM et IDFM n'ont **pas nécessairement la même licence** : conserver attributions, conditions de redistribution et versionnement pour chaque paquet ; vérifier la licence Mobilité IDFM avant intégration et distribution. Un import n'exige jamais de requêtes GTFS en direct à chaque démarrage du jeu : construire et distribuer des snapshots versionnés. Toute reconstitution de Paris à une date historique doit utiliser un millésime de réseau adéquat, non extrapoler les 30 jours d'un flux GTFS actuel.

### 3.3 Bâtiments et ambiance

Générer chaque construction en extrudant son emprise BD TOPO selon sa hauteur disponible. Si la hauteur manque : inférence explicitement marquée, puis contrôle à partir de sources supplémentaires. Produire des **façades procédurales** paramétriques, en distinguant haussmannien, faubourien, Art nouveau, Art déco, années 1960-1970 et contemporain selon les données historiques disponibles ou, à défaut, un classement heuristique non présenté comme certain. Toits en zinc, combles et lucarnes pour le patrimoine ancien pertinent ; aucun zinc appliqué mécaniquement à tous les bâtiments historiques.

Monuments (tour Eiffel, Notre-Dame, Sacré-Cœur, Arc de triomphe, grandes gares, etc.) : actifs dédiés plus détaillés et optimisés, avec autorisation/licence des modèles. Arbres d'alignement, ponts, quais, mobilier urbain, Seine, canaux animés et végétation. Water shaders réduits sur appareils modestes. Les changements d'urbanisme ou de végétalisation modifient les objets visibles et les indicateurs de simulation.

## 4. Caméra, interaction et interface

Caméra libre panoramique à 360°, zoom continu de la vue métropolitaine à la rue ; inclinaison permettant de regarder le ciel. Gestes : glisser (pan), pincer (zoom), rotation à deux doigts, inclinaison à deux doigts ; gestes configurables pour éviter l'ambiguïté rotation/inclinaison. Déplacement inertiel et lissé, avec recentrage d'origine local pour éviter les erreurs de précision du GPU sur une grande zone, sans modifier les coordonnées géographiques stockées.

Sélection par raycast/picking d'un bâtiment, piéton, véhicule, tronçon et station. Sur sélection, afficher données, origine, destination, motif et trajet lorsqu'elles existent ; pour les entités synthétiques : indiquer clairement que ces caractéristiques sont simulées. Filtres de visibilité thématiques ; la pause est indépendante du mouvement de caméra. UI lisible sur écran tactile, zones de toucher suffisantes, gestes désactivables en cas d'accessibilité.

Deux modes de vue via bouton : **surface** et **sous-sol**. Sous-sol : surface estompée ou transparente ; tunnels métro/RER, stations, couloirs de correspondance, tunnels routiers, parkings, égouts, réseaux enterrés, véhicules et charge simulés. Seuls les ouvrages documentés sont présentés comme géométriquement fiables. Les réseaux sensibles ou non publiés sont omis, approximés en schéma ou affichés sans coordonnées précises ; pas de restitution prétendument exhaustive des infrastructures enterrées.

## 5. Temps, simulation et gouvernance

### 5.1 Horloge

Vitesse de base : **1 seconde réelle = 1 minute simulée** (24 minutes réelles par jour du jeu). Pause, ×1, ×2, ×4 et ×8 (paramétrables selon coût des calculs). Date `jj/mm/aaaa`, heure `hh:mm` 24 h toujours visibles. Horloge interne fondée sur un instant UTC monotone de simulation, affichage `Europe/Paris` avec jours de semaine, transitions DST, jours fériés, vacances de zone C, saisons. Les jours de changement d'heure durent localement 23 ou 25 heures ; ne pas supposer artificiellement 1 440 minutes civiles pour ces jours. Réseau et événements recalculés par pas de simulation stables, séparés des images rendues et des FPS. La simulation peut avancer par pas agrégés lors des accélérations, sans déplacer individuellement chaque agent hors caméra.

Heures de pointe, nuits, week-ends, rentrée scolaire, vacances, festivals et évènements modifient demande, fréquentation et animation. Une date initiale du jeu sera fixée par les données disponibles ; les événements postérieurs sont modélisés et ne sont pas présentés comme observations réelles.

### 5.2 Pouvoirs publics

Moteur d'autorité institutionnelle par action : `proposer -> évaluer impact -> identifier compétence -> délibérer / autoriser / négocier -> exécuter -> contrôler / recours`. Le maire ne peut pas décider unilatéralement du RER, des grandes lignes ferroviaires, de la politique d'État ou des budgets des villes voisines. Intégrer Conseil de Paris, mairies/secteurs, État, Préfecture de police, Région Île-de-France, Île-de-France Mobilités, Métropole du Grand Paris, établissements publics et autorités de santé.

Les élections municipales suivent un cycle de six ans et les règles applicables à l'année simulée ; Conseil de Paris, majorité/opposition, votes, sondages, délégations et négociations. Le calendrier électoral et les modes de scrutin doivent être versionnés juridiquement, car une règle contemporaine n'est pas valide pour toutes les périodes. Les relations intercommunales dépendent des externalités : reports de trafic, air, logement, services, emploi, touristes, finances et projets communs.

### 5.3 Modèles et modularité

`IndicatorStore` maintient population, emplois, logements, vacance, déplacements, qualité de l'air, bruit, sécurité, recettes, dépenses, endettement, accès aux équipements et opinion, ventilés à des résolutions compatibles avec leurs sources. Les modules déclarent leurs entrées, sorties, contraintes et événements ; l'ordonnanceur résout les dépendances et interdit les boucles immédiates non contrôlées. Les effets peuvent être différés, saisonniers et soumis à incertitude calibrée ; une variable n'est jamais « réelle » simplement parce qu'elle apparaît en décimales.

Sauvegardes : IndexedDB, sérialisation versionnée, journaux d'événements/instantanés, tests de migrations, opérations atomiques et export/import de partie ; stockage serveur ou synchronisation ultérieure facultatifs et respectueux des données personnelles.

## 6. Domaines de simulation extensibles

Chaque domaine est un module isolé, relié aux mêmes indicateurs et au moteur de compétences :

1. **Gouvernance et politique :** Conseil de Paris, secteurs et arrondissements, majorité/opposition, élections, sondages, État, Région, Métropole.
2. **Finances publiques :** fonctionnement, investissement, fiscalité locale, dotations, dette, solvabilité et notation, coût pluriannuel des politiques.
3. **Urbanisme et logement :** PLU bioclimatique et évolutions, permis, logement social, loyers, vacance, meublés touristiques, insalubrité, hébergement d'urgence.
4. **Transports et mobilité :** tous les modes de la section 7, arbitrages institutionnels, circulation, stationnement, livraisons, périphérique, ZFE et accessibilité.
5. **Sécurité :** police municipale et son champ propre, Préfecture de police, BSPP, délinquance, sécurité routière, vidéoprotection, grands rassemblements.
6. **Justice et droit :** accès au droit, médiation, marchés publics et contentieux, associations requérantes, tribunaux administratifs, recours et annulation de décisions.
7. **Presse et opinion :** médias, réseaux, enquêtes, scandales, confiance, réputation et controverses.
8. **Citoyenneté et démocratie locale :** budget participatif, conseils de quartier, associations, pétitions, manifestations, grèves.
9. **Santé :** centres municipaux, PMI, hôpitaux/AP-HP, ARS, santé mentale, addictions, épidémies, pollution ; **l'AP-HP est un établissement public de santé et non un service municipal ni un simple département ministériel**.
10. **Éducation :** petite enfance, écoles et bâtiments scolaires municipaux, collèges liés aux compétences départementales de Paris, lycées régionaux, universités/État, restauration scolaire et périscolaire ; distinguer bâtiments/équipements et personnels/programmes de l'Éducation nationale.
11. **Social et solidarité :** aides, dépendance, handicap, sans-abrisme, précarité alimentaire, centres sociaux et insertion.
12. **Culture et patrimoine :** équipements, musées, théâtres, bibliothèques, conservatoires, monuments protégés, avis ABF, festivals et vie nocturne.
13. **Tourisme :** nuitées, hébergement, saturation, évènements, taxe de séjour, activité commerciale.
14. **Économie et emploi :** commerces, bureaux, start-up, marchés, artisanat, emploi et attractivité.
15. **Environnement et climat :** arbres, végétalisation, îlots de chaleur, canicules, crues, biodiversité, bruit et émissions.
16. **Services urbains :** propreté, collecte, recyclage, eau, assainissement, énergie, chauffage urbain, éclairage public et opérateurs.
17. **Sport et loisirs :** terrains, gymnases, piscines, baignade en Seine et parcs.
18. **Numérique :** services publics numériques, couverture, cybersécurité et résilience.
19. **Autres compétences :** funéraire/cimetières, animaux, diplomatie de ville, sécurité civile et gestion de crise.
20. **Commande publique et patrimoine immobilier municipal (ajout) :** appels d'offres, concessions, entretien, rénovation et valeur des actifs.
21. **Ressources humaines de la Ville (ajout) :** effectifs, métiers, rémunérations, organisation, dialogue social, absentéisme et capacités d'exécution.
22. **Accessibilité et inclusion (ajout) :** accessibilité PMR des espaces, bâtiments et transports, égalité d'accès aux services, fracture numérique.
23. **Logistique métropolitaine et approvisionnement (ajout) :** chaînes d'approvisionnement, marchés de gros, résilience alimentaire, distribution urbaine.
24. **Risques, assurance et continuité des services (ajout) :** catastrophes, plans de continuité, événements exceptionnels, maîtrise des risques.

**Interactions exigées :** exemples - rénovation de rue -> circulation perturbée à court terme -> bruit et sécurité réévalués -> fréquentation commerciale modifiée ; construction de logement -> nouveaux ménages -> besoins scolaires et de transport -> fonctionnement et investissement municipaux ; extinction d'éclairage -> économie d'énergie et modification visible -> éventuels effets sur perception de sécurité. Les relations causales sont des hypothèses calibrables, jamais des lois supposées certaines.

## 7. Transports et mobilité

### 7.1 Initialisation et données

Importer l'offre **GTFS IDFM** la plus récente compatible avec la date de départ : lignes, arrêts, courses, calendrier, fréquences et tracés quand disponibles. Construire un graphe multimodal depuis IDFM et OSM. Le réseau initial doit correspondre à l'existant sur Paris et toutes les communes voisines, avec segments extérieurs permettant les correspondances et les entrées/sorties du périmètre. Garder les projets et travaux dans un registre séparé `planned/under_construction/open`, avec dates et autorités responsables. Une ligne en chantier n'est pas exploitable avant sa mise en service en jeu.

**Limite de véracité :** GTFS contient une offre théorique, non les positions exactes ou la ponctualité réelle ; modéliser retards, incidents et charge comme des mécanismes de jeu à calibrer. L'open data ne fournit pas systématiquement horaires grandes lignes, taxis, VTC, navettes privées, trafics et réseaux techniques : utiliser d'autres référentiels permis ou une simulation déclarée, sans inventer de « données réelles ».

### 7.2 Modes et décisions

- **Ferroviaire :** toutes lignes de métro, y compris automatiques ; RER, Transilien, tramways, gares, grandes lignes (présence et interface avec le réseau national), projets Grand Paris Express.
- **Collectif routier :** bus de jour, Noctilien, navettes, cars, taxis, VTC.
- **Fluvial :** navettes et bateaux fluviaux documentés ; l'énoncé source étant interrompu après « navette », ne pas présumer de services supplémentaires imposés.
- **Autres modes déjà requis :** marche, vélo, trottinette, voiture, livraisons et logistique, stationnement, périphérique, ZFE.

Les itinéraires relient modes, correspondances, horaires, congestion, capacité et accessibilité. Évolution des fréquences, extensions et tarifs uniquement sous l'autorité compétente (souvent IDFM/exploitants) ou par négociation ; Paris décide directement de certains aménagements de voirie selon règles applicables.

## 8. Ville vivante, agents et flux

Architecture **hybride à deux résolutions** : agents individuels instanciés en zone visible et sur une couronne tampon, chacun avec origine, destination, trajet, mode et motif synthétiques ; ailleurs, matrices origine-destination et flux agrégés en pas temporels. Réconciliation massique lors des transitions (aucune création/disparition apparente au bord de caméra) via cache d'identités, génération déterministe, préactivation hors champ et fondu de LOD. On simule **des échantillons représentatifs**, pas chaque habitant et véhicule réel de la métropole à chaque frame.

Afficher piétons, cyclistes, deux-roues, voitures, bus, trams, rames, trains, bateaux, camionnettes, camions, livraison, déchets, véhicules d'urgence. Sélection et suivi d'entités : origine, destination, raison simulée du déplacement et étapes. En zone souterraine, trains animés selon horaires simulés et jauge d'occupation estimée. Couches de flux : personnes, marchandises, déchets, livraisons, tourisme ; teinte/épaisseur selon débit et légende avec unité (p. ex. agents ou trajets par heure). Distinguer précisément animation visible et représentation statistique.

## 9. Ciel, météo et lumière

- Calcul astronomique du Soleil et de la Lune aux coordonnées réelles de Paris pour l'instant du jeu ; cycle saisonnier, lever/coucher, aube, crépuscule, nuit, étoiles et phases lunaires. Les éclipses ne sont pas garanties sauf implémentation spécialisée.
- Météo dynamique : nuages, pluie, orages, brouillard, neige, canicules et voile de pollution. Modèle météorologique **synthétique** cohérent avec saison et scénarios ; météo historique uniquement si une source historique est intégrée.
- Direction/intensité solaire et ombres adaptées au ciel. Allumage de l'éclairage public selon éclairement calculé et configuration de la Ville (et non heure fixe), façades/fenêtres selon occupation du bâti, enseignes, vitrines, phares, feux, ponts, gares, quais et monuments selon règles horaires versionnées.
- Les arbitrages de gestion (réduction de l'éclairage, fermeture d'un monument, panne électrique) doivent modifier simultanément rendu, consommation et indicateurs d'usage.
- **Règle de performance :** ne pas créer une lumière dynamique projetant une ombre par lampadaire, fenêtre et véhicule ; représenter les milliers de points lumineux par matériaux émissifs, lightmaps, halos/imposteurs, clusters limités et ombres des seules sources majeures.

## 10. Moteur 3D, streaming et budgets mobiles

**Babylon.js obligatoire**, TypeScript, Vite, WebGL2 comme voie de compatibilité mobile et WebGPU **seulement si supporté et validé** ; ne pas dépendre de WebGPU pour lancer le jeu. Tuiles géographiques hiérarchiques avec géométrie, matériaux, collision, id picking et objets dynamiques séparés. Prétraitement hors ligne et compression de textures GPU (KTX2/BasisU selon compatibilité), atlas, instanciation d'objets répétés, thin instances lorsque pertinent, fusion de géométries statiques, octrees/occlusion/frustum culling, LOD et budgets de mémoire. La sélection d'un bâtiment doit survivre aux changements de LOD et de tuile. Préchargement autour de la caméra, annulation de requêtes obsolètes, déchargement LRU et cache disque limité. Origine flottante pour précision numérique ; références géographiques en Lambert-93 / coordonnées locales sans dérive.

**Paramètres initiaux à mesurer et ajuster sur de vrais appareils**, non garanties de capacité :

| Qualité | Bas | Moyen | Haut |
|---|---|---|---|
| Résolution interne | 60–75 % | 75–90 % | 90–100 % |
| Agents visibles ciblés | ~100–300 | ~300–800 | ~800–1 500 |
| Ombres | 1 cascade / résolution basse, désactivation optionnelle | 1–2 cascades | 2–3 cascades si GPU compatible |
| Lumières de rue | émissif + halos simplifiés | émissif + lumières locales sélectionnées | idem + effets renforcés |
| Ciel, nuages, météo | ciel analytique et particules limitées | nuages simplifiés | nuages/particules plus denses |
| Eau | texture défilante | reflets simplifiés | SSR/reflets locaux optionnels |
| Bâtiments éloignés | imposteurs/extrusions simples | LOD intermédiaires | LOD étendus |
| Sous-sol | réseau filtré / seul mode choisi | modes sélectionnés | détails supplémentaires près caméra |

Chiffres de densité **indicatifs et à profiler** : la limite dépend du matériel, des triangles, shaders, matériaux, navigation, ombres et mémoire, pas d'un nombre théorique d'agents. Dégradation automatique graduelle si FPS glissants < 30 : baisser résolution de rendu, densité d'agents, distance LOD, précision d'ombres et effets météo, en préservant la cohérence de simulation. Les appareils incompatibles affichent un message et une option de rendu allégé plutôt que de tenter des fonctions non supportées.

**Contrôle d'acceptation :** mesures sur au moins un smartphone Android récent de gamme intermédiaire, un appareil plus performant et une tablette représentative ; parcours rue dense, grand panorama, pluie nocturne, crue et vue sous-sol, zoom/pan rapides, accélération ×8, mémoire et consommation batterie ; référence ≥30 FPS soutenus en qualité adaptée, sans fuite mémoire ni disparition visible d'agents lors du streaming. Publication d'un profil matériel et d'une résolution par test.

## 11. Faisabilité : impossibilités et alternatives obligatoires

| Demande | Évaluation | Alternative réalisable |
|---|---|---|
| Toute la métropole en géométrie détaillée et tous agents physiques en permanence | **Irréaliste sur mobile** | streaming/LOD, simulation agrégée hors vue et échantillons d'agents visibles |
| 3D « réelle » de chaque façade d'après seule emprise/hauteur BD TOPO | **Informations insuffisantes** | génération procédurale à classification probabiliste + monuments et secteurs de référence manuels |
| Profondeurs exactes, couloirs, égouts et réseaux enterrés exhaustifs | **Données incomplètes et parfois sensibles** | réseau public partiel, schémas positionnés approximativement, visibilité de l'incertitude |
| Tous feux, vitrines, fenêtres, phares avec ombres dynamiques | **Irréaliste sur mobile** | émission, atlas, culling et quelques ombres centrales |
| « Temps réel » ferroviaire à partir de GTFS seul | **GTFS = théorique** | simulation temporelle adossée aux horaires, retards synthétiques ; données temps réel séparées si autorisées |
| Reproduction strictement conforme des communes et de la circulation par simples données ouvertes | **Données hétérogènes, parfois manquantes** | validation SIG, bases datées, calibration et hypothèses visibles |
| 30 FPS garantis sur tout téléphone/tablette récent sans profilage | **Garantie impossible a priori** | cible contractualisée par appareils de référence et qualité adaptative |
| Libre navigation « sans bord » jusqu'à l'infini en détail égal | **Hors périmètre impossible** | toutes les tuiles chargées dans l'emprise autorisée ; lointain stylisé sans bord visible |

## 12. Feuille de route et critères d'acceptation

**Étape 1 - 4e arrondissement.** Import de bâtiments réels avec géométrie et hauteur, extrusion dans Babylon.js ; projection SIG correcte ; caméra tactile complète, continuité des gestes, zoom jusqu'à la rue, picking stable d'un bâtiment. Prototype fonctionnant sur smartphone récent, métriques FPS documentées. Le 4e reste une unité géographique malgré Paris Centre.

**Étape 2 - Façades et ambiance.** Six familles architecturales, toitures adaptées, arbres, eau, rues, monuments pilotes, Soleil/Lune et cycle jour-nuit, premier niveau météo ; contrôles visuels et performance sur mobile.

**Étape 3 - Streaming complet.** Tuiles et LOD, extension aux 20 arrondissements, deux bois, **toutes les communes limitrophes validées IGN** ; qualité équivalente proche caméra, fond simplifié au-delà, 3 profils graphiques et réglage adaptatif ; mesure de mémoire et FPS.

**Étape 4 - Simulation socle et finances.** Horloge 1 s = 1 min, calendrier Europe/Paris, indicateurs communs, registres d'autorité, sauvegarde/migration et module Finances (dépenses, recettes, dette, actions et votes). Tests de cohérence et déterminisme.

**Étape 5 - Transports.** Graphes OSM/IDFM, réseau existant, offres GTFS, projets distincts, agents hybrides, flux, répartition des compétences ; tests des correspondances, fréquences et trafic à divers horaires sur mobile.

**Étape 6 - Surface/sous-sol, lumière et ville vivante complète.** Caméra ciel et sous-sol, trains animés, occupations, éclairages de nuit, météo avancée, couches de flux, picking d'agents ; limites documentées des réseaux non publiés.

**Étapes suivantes - un domaine à la fois.** Ordre prioritaire envisagé : urbanisme/logement ; gouvernance ; environnement ; sécurité ; services urbains ; santé/éducation/social ; économie ; puis autres domaines. Chaque module : contrat d'API, jeu de données, scénario de test, sauvegarde/migration, test mobile et régression des modules existants. Aucun nouveau domaine sans test de la version précédente sur appareil réel.

### Définition de « terminé » (par étape)

- démo exécutable hors machine de développement sur un mobile réel ;
- provenance des données, licences et versions documentées ;
- métriques de performance (FPS, latence, RAM) et seuils testés ;
- aucune violation des compétences institutionnelles ;
- sauvegarde/restauration et tests de déterminisme dès l'étape 4 ;
- fonctionnement en qualité basse quand la haute qualité échoue.

## 13. Références sources et points à vérifier

- **IGN ADMIN EXPRESS (limites et millésimes) :** https://www.data.gouv.fr/datasets/admin-express-admin-express-cog-admin-express-cog-carto-admin-express-cog-carto-pe-admin-express-cog-carto-plus-pe
- **Données administratives :** https://www.data.gouv.fr/pages/donnees-geo
- **INSEE, Code officiel géographique :** https://www.insee.fr/fr/information/2560452
- **Ville de Paris, liste des communes limitrophes :** https://prod-v3.paris.fr/pages/demander-un-logement-social-37
- **Ville de Paris, compétences :** https://www.paris.fr/pages/mairie-de-paris-mairie-d-arrondissement-qui-fait-quoi-33533
- **Ville de Paris, spécificités de sécurité municipale :** https://www.paris.fr/pages/tout-savoir-sur-la-police-municipale-parisienne-16970
- **Île-de-France Mobilités, GTFS prévu :** https://prim.iledefrance-mobilites.fr/jeux-de-donnees/offre-horaires-tc-gtfs-idfm
- **OpenStreetMap :** https://www.openstreetmap.org/copyright
- **Babylon.js :** https://www.babylonjs.com/

**Risques ouverts de cette version :** (1) calcul SIG IGN de la contiguïté non exécuté ; (2) absence de fichier d'architecture initial dans la session ; (3) complément « TRANSPORTS » reçu tronqué après « Fluvial : navette » ; (4) licences et disponibilités des données nécessaires à contrôler dans l'implémentation ; (5) plafonds de rendu et densités d'agents à confirmer par profilage. Les estimations ci-dessus ne constituent pas des résultats d'essais de performance.


## 14. Contrainte absolue de gratuité et publication depuis Android

**Condition bloquante :** aucun composant obligatoire payant, aucune clé de service facturable, aucun hébergement commercial ou CDN tiers payant. Le code source et les scripts restent dans **un dépôt GitHub public** ; seul le propriétaire du compte crée et configure initialement le dépôt depuis Chrome Android. Aucun ordinateur n'est nécessaire.

| Fonction | Choix gratuit | Restriction |
|---|---|---|
| Gestion de code | GitHub, dépôt public, branche principale `main` | Le code et les données commités deviennent publics |
| Préparation de données | GitHub Actions, Python, Shapely, services ouverts | Quotats/règles d'usage des fournisseurs à respecter |
| Compilation | GitHub Actions, Node.js, npm, Vite | Les workflows peuvent échouer si un service public est indisponible |
| 3D | Babylon.js sous licence ouverte | WebGL disponible requis ; WebGPU non obligatoire |
| Hébergement | **GitHub Pages** | Site publié limité à **1 Go**, trafic souple **100 Go/mois**, déploiement limité dans le temps |
| Installation Android | PWA, manifeste et service worker | Chrome Android et navigateur compatibles ; stockage révocable par le système |
| Sauvegardes multiples (étape 4) | IndexedDB local, export/import JSON ou fichier compressé | Aucune synchronisation multi-appareil sans solution supplémentaire |

GitHub Pages sert exclusivement l'interface et les ressources statiques réduites. Le recours à un CDN tiers n'est **pas requis**. Les fichiers de données sont produits par Actions, enregistrés sous `public/data`, publiés après compilation et mis en cache localement. Les endpoints IGN et Ville de Paris sont interrogés **par Actions**, jamais au moment du rendu mobile du prototype. Les licences et attributions restent applicables.

### 14.1 PWA, hors ligne et sauvegardes

L'application web progressive utilise un manifeste, des icônes, un service worker généré lors de la compilation et un cache d'assets. Le lancement hors ligne est possible **après premier chargement terminé et activation du cache**, et reste soumis à la disponibilité du stockage Android. Un accès hors ligne intégral à tous les arrondissements et communes limitrophes n'est **pas garanti** si les paquets correspondants n'ont pas été téléchargés, ou si le navigateur les a effacés.

À partir de l'étape 4 : écran « Parties » en français ; création, duplication, renommage, suppression et chargement de plusieurs parties ; sauvegarde IndexedDB atomique ; export vers un fichier Android et import depuis un fichier, avec confirmation en cas d'écrasement. L'identité du joueur ou un compte distant ne sont pas nécessaires pour jouer hors ligne. Les migrations de sauvegarde et la traçabilité juridique sont introduites **à l'étape 4, pas avant**.

### 14.2 Règles permanentes de travail

1. Développer une seule étape ou un seul domaine à la fois. Ne pas ajouter de fonctionnalités de l'étape suivante tant que les critères du téléphone ne sont pas satisfaits.
2. Toujours distinguer donnée officielle, valeur estimée et simulation ; ne jamais générer de faux bâtiments présentés comme réels.
3. Conserver l'interface, les messages d'erreur, les consignes et les tests en français. Fournir le contenu complet du dépôt et la commande GitHub Actions qui l'utilise.
4. Aucun tiret cadratin dans les documents. Préférer le point, le deux-points ou le tiret simple.
5. Ne pas introduire de service payant ou à facturation potentiellement automatique. Évaluer les quotas gratuits avant toute dépendance externe.
6. En cas d'exigence mobile irréalisable, l'indiquer, prioriser la fluidité, proposer un rendu simplifié et consigner la différence entre ambition et résultat observé.
7. Tester les changements sur le seul Android disponible, conserver les captures et le FPS mesuré ; un workflow vert ne remplace pas la validation tactile réelle.
8. Définir une livraison reproductible : sources du dépôt, workflow d'extraction, workflow de publication, données attribuées et rapport d'échec lisible. Ne pas annoncer la publication avant d'avoir observé un déploiement réussi.

## 15. Dimensionnement prévisionnel de Paris et de la première couronne limitrophe

**Il s'agit d'ordres de grandeur de planification, non de volumes calculés à partir d'une extraction complète.** Estimer les actifs compressés distribués sur le téléphone et le total statique de GitHub Pages est indispensable avant la généralisation. Périmètre : 20 arrondissements, bois inclus, plus communes adjacentes déterminées par calcul IGN.

| Poste | Fourchette compressée indicative |
|---|---:|
| Bâtiments : emprises, hauteurs, attributs, tuiles | 150 à 500 Mo |
| Voirie, sols, végétation, cours d'eau et terrain | 70 à 250 Mo |
| Matériaux/atlas, façades, détails de bâtiments | 250 à 950 Mo |
| Monuments et ouvrages détaillés | 100 à 450 Mo |
| Transports, réseaux, géographie administrative et données de simulation | 50 à 250 Mo |
| Moteur, interfaces et ressources diverses | 10 à 60 Mo |
| **Total potentiel** | **630 à 2 460 Mo** |

Les fourchettes sont additives mais incertaines, les données peuvent être partagées et les textures procédurales peuvent réduire sensiblement le poids. Avec un objectif visuel élevé, **la totalité peut dépasser 1 Go et ne peut pas être déclarée hébergeable sur GitHub Pages avant une mesure**. Un contrôle automatique bloque toute publication supérieure à **900 Mo** pour conserver une marge sous le plafond du service.

**Solution gratuite prioritaire :** un socle Pages compact, des façades procédurales calculées côté client, des niveaux de détail limités, des tuiles fortement quantifiées et compressées, et un cache PWA sélectif. Maintenir le socle public sous 900 Mo. Si les ressources détaillées dépassent réellement cette limite, distribuer les secteurs facultatifs en **paquets téléchargeables via GitHub Releases** et importables localement depuis Android, plutôt que gonfler le site Pages ou servir les fichiers Releases comme un CDN permanent. Vérifier au moment de l'usage les limites et les conditions de GitHub Releases, ainsi que la licence de chaque paquet. Les téléchargements optionnels restent gratuits dans les quotas de la plateforme, sans garantie de service illimité. Si ces contraintes sont incompatibles avec la demande de disponibilité complète permanente, il faudra réduire le détail ou admettre explicitement qu'une solution totalement gratuite, exhaustive et garantie n'est pas acquise.

Le poids définitif sera mesuré par `scripts/check_site_size.py` et un rapport d'assets par territoire, avant l'extension au-delà du 4e. **Étape 1 :** viser moins de 25 Mo de données géographiques pour le pilote et contrôler la mémoire et la batterie sur l'Android disponible.

## 16. Architecture du dépôt et séquence de création

Le dépôt public GitHub contient `ARCHITECTURE.md`, `README.md`, `GUIDE_ANDROID.md`, `TEST_ANDROID.md`, `CREDITS_DONNEES.md`, `ARBORESCENCE.md`, `index.html`, `package.json`, `tsconfig.json`, `vite.config.ts`, `src/`, `public/`, `scripts/`, `tests/` et `.github/workflows/`. Voir `ARBORESCENCE.md` pour chaque fichier.

Depuis le téléphone : création d'un dépôt public, import d'un ZIP initial avec workflow d'amorçage, lancement de `Préparer les données IGN` pour conserver les snapshots dans le dépôt, lancement de `Publier PARIS sur GitHub Pages`, activation du mode « GitHub Actions » dans Settings > Pages et ouverture de l'URL. Des commits ultérieurs sur `main` déclenchent la publication. Les déclenchements entre workflows après un commit effectué avec `GITHUB_TOKEN` ne doivent pas être présumés ; la publication peut être lancée manuellement.

La génération de la liste des communes limitrophes IGN et la préparation des flux IDFM viendront dans les étapes concernées ; le script de l'étape 1 ne crée **que** les données du 4e.

## 17. Critères d'acceptation adaptés au seul téléphone Android

**Étape 1 (tests manuels dans `TEST_ANDROID.md`) :** Chrome Android ; site Pages chargeant de vrais bâtiments IGN ; caméra tactile à un doigt (translation) et deux doigts (pincement, rotation, inclinaison) ; sélection de trois bâtiments et affichage des identifiants/hauteurs ; retour au centre ; qualités basse, moyenne, haute ; maintien de la scène pendant dix minutes ; tentative à 30 FPS en mode qualité adapté ; installation PWA et reprise hors ligne une fois les tuiles intégralement mises en cache ; interface utilisable en portrait et paysage. En cas d'échec, ne pas valider l'étape et corriger le code. Les mesures ne sont pas réputées effectuées avant que l'utilisateur les relève sur son téléphone.

À partir de l'étape 4 seulement : scénarios de sauvegardes multiples, intégrité, migrations, déterminisme et versionnement des règles juridiques. À chaque étape de simulation ultérieure, ajout d'un unique domaine puis essai sur l'Android avant de continuer. Les tests automatisés exécutés dans GitHub Actions complètent mais ne remplacent jamais les essais tactiles.

## 18. Complément transports et documents sources manquants

Le complément « Transports » accessible ici s'interrompt après « Fluvial : navette ». Les exigences reçues portent sur les données IDFM GTFS et OSM, métro, RER, Transilien, tramway, grandes gares et trains grandes lignes, Grand Paris Express, bus, Noctilien, navettes, cars, taxis, VTC et navettes fluviales. La suite non communiquée n'est pas devinée. Le texte complet du cahier initial n'est pas présent non plus ; les choix PWA, mode hors ligne, Vite, multi-sauvegardes et règles de travail sont bien intégrés à la présente version conformément à la demande de révision, mais tout contenu spécifique supplémentaire devra être confronté au texte lorsqu'il sera fourni.

**Références techniques des limites gratuites :** https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits ; https://docs.github.com/en/actions/concepts/billing-and-usage ; https://vite.dev/guide/static-deploy ; https://opendata.paris.fr/explore/dataset/arrondissements/ ; https://cartes.gouv.fr/aide/fr/guides-utilisateur/utiliser-les-services-de-la-geoplateforme/diffusion/wfs/

## 18. Contrats de rendu, bâtiments et noms de rues, version 0.4

### Bâtiments : permanence géographique absolue

Le zoom et le réglage graphique ne doivent jamais changer la présence des bâtiments dans le périmètre couvert.
Dans le prototype du 4e, les 27 tuiles IGN et leurs 2 696 bâtiments sont chargés intégralement, puis conservés en mémoire, sans déchargement selon le zoom ni la caméra. Les boutons + et - agissent uniquement sur la distance de caméra. Cette règle doit être validée sur Android avec un nombre de bâtiments constant, une fois le chargement achevé.

Pour tout Paris et les communes limitrophes, la présence géographique des bâtiments sera conservée avec des niveaux de détail, une représentation distante et un chargement progressif des géométries. Afficher simultanément les maillages détaillés de tous les bâtiments serait irréaliste sur un téléphone. Les bâtiments hors champ peuvent donc ne pas occuper la mémoire graphique, sans cesser d'exister dans les données ou de réapparaître à la caméra.

### Fidélité des façades et des toitures

Les emprises, identifiants, usages et hauteurs disponibles proviennent de la BD TOPO IGN. La période historique de construction, le matériau réel de chaque mur, l'emplacement exact des fenêtres, la géométrie complète de chaque toiture et les lucarnes ne sont pas contenus de manière exhaustive dans ces données.

Le moteur distingue provisoirement des habillages résidentiels, commerciaux, religieux et neutres selon l'usage renseigné, avec un revêtement spécifique pour les couvertures. Ces apparences sont **illustratives**, jamais des relevés attestés. Quand des attributs vérifiés deviennent accessibles, le moteur les applique par bâtiment ; sinon il conserve un habillage plausible, explicitement non certifié. Il ne faut jamais affecter un style historique de façon aléatoire en le présentant comme réel.

### Noms des voies : affichage permanent

Aucune commande ne désactive les noms de voies. Les noms officiels sont issus du jeu de données de la Ville de Paris « Dénominations des emprises des voies actuelles ». Le jeu pilote contient les 205 voies recensées pour le 4e, y compris rues, places, quais, ponts, passages et autres emprises nommées. Chacune est conservée dans les données avec son ancrage géographique. Les étiquettes suivent en permanence le mouvement, l'inclinaison et le zoom de la caméra.

Sur mobile, la lisibilité simultanée de centaines ou de milliers de noms à l'échelle générale n'est pas matériellement possible sans chevauchement. La règle « aucun nom omis » s'applique au référentiel et à la disponibilité des étiquettes ; les indications hors champ ou masquées par les perspectives ne peuvent pas être lisibles à l'écran en même temps. Des étiquettes supplémentaires et une gestion d'espacement sont prévues pour l'extension à tout Paris.

### Vérification obligatoire

Avant la prochaine étape, vérifier sur le téléphone Android :
1. Que le nombre final de bâtiments reste à 2 696 après plusieurs zooms avant et arrière.
2. Que les bâtiments restent sélectionnables à toutes les distances autorisées.
3. Que les revêtements de murs et de toitures sont distincts et que les informations de provenance ne prétendent pas reproduire le matériau exact.
4. Que les noms de toutes les voies officielles du 4e sont chargés et suivent la caméra, sans option de désactivation.
5. Que la fluidité reste au minimum à 30 FPS dans plusieurs vues urbaines chargées.

## 19. Cycle céleste et éclairages, version 0.5

Le temps du jeu est un instant absolu. À vitesse normale, 1 seconde réelle correspond à 1 minute du jeu. Pause, ×1, ×10 et ×60 sont accessibles dans l'interface. La date et l'heure sont affichées en français au fuseau `Europe/Paris`, avec les passages aux heures d'été et d'hiver. Aucune persistance de l'horloge avant l'étape 4.

La position du Soleil et de la Lune utilise une approximation astronomique basée sur le calendrier et les coordonnées de Paris (48,8566° N, 2,3522° E). Les phases lunaires et les variations saisonnières sont simulées. La précision n'est pas destinée à la navigation astronomique.

Le ciel est une voûte peu coûteuse en géométrie, avec des couleurs jour, nuit, aube et crépuscule ; les étoiles constituent un fond décoratif, non un catalogue astronomique. Le niveau d'éclairage ambiant dépend de l'altitude du Soleil. Aucun rendu d'ombres portées dynamiques n'est activé sur cette étape pour préserver la fluidité.

L'éclairage public est approché par des instances graphiques de poteaux et de globes. Les positions sont déduites des voies officiellement nommées, pas d'un inventaire réel des lampadaires. Les globes s'illuminent quand l'altitude du Soleil descend sous l'horizon selon un seuil de crépuscule, sans création de centaines de véritables lumières Babylon.

Les fenêtres utilisent des textures nocturnes procédurales mutualisées par usage du bâtiment. Leur état suit une hypothèse d'occupation résidentielle ou professionnelle. Il ne décrit pas les habitudes des occupants réels et ne modifie pas les informations IGN. Les décisions budgétaires concernant l'éclairage seront raccordées au simulateur à partir de l'étape 4.

Les tests automatiques couvrent la position du Soleil aux solstices, les conditions d'allumage et les changements d'heure de Paris. L'acceptation des performances exige ensuite une vérification réelle sur le téléphone Android, notamment 30 images par seconde au minimum.

## 20. Affichage cartographique discret des odonymes

Les noms officiels restent conservés dans les données et dans le moteur, mais ne sont **pas visibles en vue d'ensemble**. Ils apparaissent seulement lorsque la caméra s'approche de la rue concernée. Le rendu vise celui d'une carte numérique, sans encombrer la vue.

- Taille fixe de 9 pixels CSS, sans agrandissement ou étirement avec le zoom.
- Opacité réduite, sans cartouche opaque, orientation suivant la voie et ancrage sur son emprise géographique officielle.
- Masquage lorsque le rayon de caméra dépasse 720 mètres, avec fondu progressif et critère de proximité locale.
- Répétition d'un nom sur les voies longues à intervalles proportionnels à l'emprise, avec points systématiquement situés dans la géométrie officielle.
- Évitement automatique des collisions à l'écran, plafond de 28 textes simultanés et absence de texte sur les commandes.
- Une étiquette non visible ne signifie jamais que la rue manque du référentiel. La géométrie des bâtiments et leurs règles de chargement sont inchangées.

Ces valeurs peuvent être affinées après le test sur Android. Les portions de rue couvertes par des bâtiments ou par des superpositions de texte peuvent ne pas présenter d'étiquette visible à chaque instant. Cette restriction est nécessaire pour conserver une carte lisible.

## 21. Objectif de fidélité architecturale, formes et revêtements documentés

### Exigence et limites juridiques

La cible est de reproduire, bâtiment par bâtiment, la forme réelle, la toiture, les matériaux visibles et, dans les zones suffisamment documentées, les façades du Paris existant, avec un niveau de réalisme visant la qualité d'une cartographie 3D photoréaliste. Les textures procédurales génériques de la version 0.5 sont uniquement provisoires.

Les modèles 3D, les images et les textures de Google Maps / Google Earth ne doivent PAS être extraits, copiés, redessinés à partir de ces contenus, stockés pour un usage hors ligne ni redistribués dans notre moteur Babylon.js. Les règles de l'API Google Map Tiles interdisent notamment l'extraction et la création de modèles dérivés de son contenu. Cette API est facturable et ne garantit pas la gratuité permanente. Il faut conserver la politique stricte « zéro service payant et réutilisation autorisée ».

### Sources prioritaires gratuites

1. IGN BD TOPO : emprises, hauteurs, géométries 3D lorsqu'elles sont suffisamment renseignées, niveaux, et champs **materiaux_des_murs** et **materiaux_de_la_toiture** lorsqu'ils sont présents. Ces deux champs existent dans le descriptif officiel de la BD TOPO, mais sont facultatifs et portent des codes de fichiers fonciers. Avant affichage, vérifier leur présence dans le WFS actuel, la proportion des valeurs renseignées à Paris, et la table de correspondance officielle des codes. **Ne jamais les présenter comme exhaustifs ni comme la mesure visuelle de chaque façade.**
2. IGN LiDAR HD : modèles numériques de terrain, de surface et de hauteur, ou nuages de points, pour restituer progressivement les pentes, faîtages, toits mansardés, volumes et relief. Contrôler la disponibilité précise des dalles et leur capacité à décrire les arêtes du toit. Si la qualité est insuffisante, conserver une géométrie neutre signalée comme non vérifiée.
3. Photographies au sol librement réutilisables, notamment Panoramax, selon la licence attachée à chaque image et sa couverture locale, pour vérifier les détails de façades. Conserver les attributions, contrôler les contraintes de redistribution et éviter toute reproduction de visages, plaques d'immatriculation ou éléments privés.
4. OpenStreetMap : attributs roof:shape, roof:material, building:material et autres attributs utiles **uniquement lorsqu'ils existent réellement** et sont compatibles avec les sources officielles. Conserver attribution et licence ODbL.
5. Monuments : modèles spécifiques indépendants, obtenus sous licence libre compatible ou modélisés sur des mesures et sources autorisées.

### Ordre d'exécution, avant extension massive à Paris

- Phase A : auditer les champs de matériaux et les géométries disponibles sur l'échantillon du 4e, par identifiant IGN. Publier un bilan de couverture : nombre connu, inconnu, ambigu. Aucune valeur « réelle » inventée.
- Phase B : conserver les codes matériaux des murs et de couverture avec provenance dans les tuiles. Associer des variantes visuelles au matériau seulement lorsque le code a une signification officiellement vérifiée.
- Phase C : reconstruire les formes réelles des toitures d'après les données 3D et LiDAR HD lorsque la précision est suffisante. Préserver les bâtiments existants et l'invariance du zoom.
- Phase D : enrichir les façades avec des références photographiques libres et documentées, par bâtiment et par rue, puis construire les monuments en détail.
- Phase E : optimiser l'ensemble pour Android avec LOD, géométries groupées, textures compressées et chargement progressif, sans modifier la présence géographique des bâtiments.

**Définition d'une représentation fidèle :** géométrie et matériau attribués à un bâtiment déterminé avec source vérifiable. Sinon, l'apparence reste « provisoire / non documentée ». Ne pas transformer une hypothèse haussmannienne en donnée prétendument officielle. Viser 30 FPS minimum sur le téléphone de test.

### Références de conformité

- Google : https://developers.google.com/maps/documentation/tile/policies
- IGN BD TOPO (descriptif version 3.3) : https://geoservices.ign.fr/sites/default/files/2023-10/DC_BDTOPO_3-3.pdf
- IGN LiDAR HD : https://geoservices.ign.fr/
- Panoramax : https://panoramax.fr/


## 22. Premier déploiement des matériaux et formes réels, version 0.6

### Extraction et vérification

- Les 2 696 identifiants IGN sont conservés sans changement. La jointure de données supplémentaires est faite par identifiant stable, jamais par rang dans une liste.
- Les codes des gros murs et des toitures de la BD TOPO proviennent des fichiers fonciers Cerema et DGFiP. Ils sont décodés avec la nomenclature officielle, puis associés aux matériaux procéduraux correspondants.
- Après jointure complète, 1 315 bâtiments ont un matériau des gros murs exploitable, 1 334 un matériau de toiture exploitable et 2 002 un nombre d'étages. Le code 00 ou une absence de code reste « non documenté ».
- Les matériaux fiscaux des gros murs n'indiquent pas forcément le revêtement apparent. Une texture de pierre ou de brique représente le matériau déclaré sans prétendre reproduire la façade réelle, les couleurs exactes, ni les ouvertures. Les combinaisons de matériaux restent consultables dans l'inspecteur.
- Les formes de toiture OSM sont rapprochées des emprises IGN par recouvrement géométrique IoU supérieur ou égal à 0,63 et sans ambiguïté entre deux candidats. Ce contrôle valide 59 bâtiments dans le 4e. Seuls huit possèdent une hauteur de toiture renseignée. Pour les autres, la silhouette du toit suit son type renseigné, mais sa hauteur est estimée et explicitement signalée.
- Les pentes de toit sont générées en conservant la hauteur maximale IGN. Les toits sans forme libre vérifiée restent plats provisoirement, sans extrapolation abusive.

### Limites de la source IGN et étapes suivantes

Un contrôle de 220 géométries WFS a montré que l'altitude des sommets est constante pour chaque contour de bâtiment. Les données extraites seules ne permettent pas de restituer la géométrie complète d'une toiture réelle.

Le jeu de données officiel « Volumes bâtis » de la Ville de Paris comporte 8 664 volumes pour le 4e arrondissement, avec une emprise des retraits et surplombs, et des valeurs en nombre d'étages. Ces volumes devront être reliés géométriquement aux bâtiments IGN et convertis en volumes 3D avec une méthode explicitant les incertitudes altimétriques, avant toute substitution dans le rendu. Le LiDAR HD reste la source préférentielle pour une hauteur de toiture mesurée.

Le but est de reproduire la forme et le parement visuellement exacts lorsque des données ou photographies libres autorisent cette reconstruction, et de signaler explicitement les approximations ailleurs. Il est interdit d'extraire des maillages ou textures Google Maps. L'intégration d'autres données ouvertes dépend de la licence précise et de la qualité des attributs.

### Performance

Le programme ne crée pas un matériau unique pour chaque immeuble. Les textures sont mutualisées par classe physique. Les bâtiments restent sélectionnables dans le même référentiel IGN. Les 59 formes de toiture ajoutent des triangles uniquement aux bâtiments concernés. L'objectif de 30 FPS minimum doit être validé par observation sur l'Android du joueur.


## 23. Vérification visuelle sur Android et ergonomie légère

Les captures du 7 novembre 2026 indiquent 2 696 bâtiments conservés à l'écran, 58 à 60 FPS et le chargement correct des matériaux et formes de toit de la version 0.6. Il s'agit de trois observations à l'instant des captures et non d'un benchmark garanti.

Les diagnostics détaillés sont conservés dans un panneau « Détails » replié par défaut. Le pied d'écran montre seulement le nombre de bâtiments et les FPS. Les crédits restent accessibles et identifiés dans les détails.

Les noms des rues restent petits (9 pixels), à faible opacité et proches de leur emprise réelle. Avant de dessiner une étiquette, un test de profondeur est réalisé contre les maillages des bâtiments. Une étiquette occultée par une façade ou une toiture ne doit pas être placée devant le bâtiment. Le nombre de tests est plafonné par le désencombrement et par un intervalle de rafraîchissement d'environ 240 ms. Si la fluidité mobile chute, réduire d'abord la fréquence de vérification, jamais le nombre de bâtiments conservés.

