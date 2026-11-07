# Test de l'étape 1 sur Android

1. Ouvrir l'URL HTTPS de la version de démonstration depuis Chrome Android.
2. Vérifier que les bâtiments réels du 4e sont visibles sans message de données manquantes.
3. Glisser un doigt pour déplacer la carte.
4. Pincer avec deux doigts pour zoomer et dézoomer.
5. Tourner avec deux doigts et incliner en déplaçant le centre du geste.
6. Appuyer sur un bâtiment, puis vérifier la hauteur, l'usage et l'identifiant IGN.
7. Utiliser les boutons +, -, N et la remise au centre.
8. Essayer les trois réglages graphiques. Cible : au moins 30 FPS sur le téléphone testé.
9. Vérifier que les erreurs de téléchargement sont affichées sans faux bâtiments.
10. Couper le réseau et vérifier seulement les contenus effectivement mis en cache par la PWA. Ne pas promettre l'intégralité de Paris hors ligne à cette étape.

Échec bloquant : page blanche, erreur JavaScript, sélection incohérente, données fictives ou impossibilité de naviguer au doigt.

## Version 0.2, infrastructures

1. Vérifier sur l'écran de chargement que l'état « tronçons de voirie, ponts » apparaît, et non « Voirie indisponible ».
2. Identifier des chaussées grises, des trottoirs clairs, la Seine bleutée, des berges et les ponts.
3. Déplacer la caméra de l'île Saint-Louis vers l'île de la Cité et leurs accès, puis zoomer à proximité d'un pont.
4. Vérifier que les bâtiments restent sélectionnables et que les commandes tactiles fonctionnent.
5. Observer l'indicateur FPS en qualité moyenne : viser 30 FPS minimum dans les zones chargées.
6. Ouvrir le bouton d'aide « ? » et vérifier qu'il n'obstrue plus la carte en permanence.
7. Vérifier que le lien de crédits OpenStreetMap est visible.

La largeur exacte des rues, l'élévation des ponts, le détail des trottoirs et la précision hydrologique doivent encore faire l'objet de validations supplémentaires. Aucune mesure de performance ne peut être extrapolée d'une capture isolée.

## Version 0.3, vérification sur le téléphone Android

1. Ouvrir l'application publiée puis actualiser pour charger la nouvelle version PWA.
2. Vérifier que les arbres sont visibles près des rues et dans les espaces verts, sans être systématiquement répartis au hasard.
3. Vérifier qu'un pont a désormais un tablier épais et des parapets, en conservant des passages ouverts aux extrémités.
4. Zoomer sur les façades et contrôler l'apparition des fenêtres procédurales ; ne pas les confondre avec une reconstitution architecturale certifiée.
5. Déplacer la caméra dans plusieurs directions. Les arbres distants doivent pouvoir disparaître de la zone dessinée sans immobiliser la caméra.
6. Tester basse, moyenne puis haute qualité, contrôler l'absence de fermeture et viser au moins 30 FPS en usage normal.
7. Vérifier que le bouton de sélection d'un bâtiment conserve le bon identifiant et la bonne hauteur.
8. Observer l'horizon et vérifier que la brume n'efface pas complètement les immeubles à proximité.
9. Vérifier la présence des attributions IGN et Ville de Paris.

En cas de chute durable sous 30 FPS, réduire d'abord la distance des arbres, puis leur densité et la qualité des façades.


## Version 0.4 : bâtiments permanents, revêtements, noms de voies

1. Laisser le chargement des bâtiments du 4e se terminer. Le compteur doit afficher 2 696.
2. Appuyer dix fois sur + puis dix fois sur -. Le compteur doit rester à 2 696 et les mêmes bâtiments doivent rester présents.
3. Déplacer, incliner et faire pivoter la caméra, puis revenir à la vue initiale. Aucun bâtiment du périmètre ne doit être supprimé.
4. Toucher plusieurs bâtiments de fonctions différentes pour vérifier l'identifiant IGN, la hauteur et la mention « habillage stylisé ».
5. Observer les fenêtres, revêtements de murs et toitures séparées. Vérifier qu'aucun matériau non sourcé n'est présenté comme attesté.
6. Vérifier la présence des noms de voies à l'écran, notamment rue de Rivoli, rue Saint-Antoine, quai de l'Hôtel de Ville et pont Saint-Louis. Les étiquettes doivent suivre la caméra et rester actives à tous les réglages de qualité.
7. Vérifier 30 FPS minimum en situation normale sur votre Android ; signaler toute chute durable ou fermeture de l'application.
8. Si le navigateur conserve l'ancien moteur PWA, actualiser la page puis la rouvrir.


## Version 0.5 : recette sur l'unique téléphone Android

1. Actualiser la page publiée et vérifier « PROTOTYPE 05 ».
2. Vérifier la date au format français et l'affichage de l'heure sur 24 heures.
3. Appuyer sur « Ⅱ » : l'heure doit se figer. Passer à ×1, ×10, puis ×60.
4. À ×60, observer un cycle complet en environ 24 secondes : jour, crépuscule, nuit, aube.
5. Vérifier que le soleil évolue selon l'heure et que le ciel nocturne comporte une lune avec phase.
6. À la nuit, observer les lampadaires schématiques et certaines fenêtres illuminées.
7. Vérifier que le nombre de bâtiments reste à 2 696 pendant tous les cycles et que les noms de rues restent disponibles.
8. En qualité Basse, Moyenne et Haute, observer la fluidité avec un objectif de 30 FPS minimum.
9. Vérifier qu'une sélection de bâtiment fonctionne toujours et que le panneau d'horloge ne bloque pas la caméra.
10. Faire une capture de jour et une de nuit avec les FPS visibles, puis signaler toute différence anormale.

Les éclairages restent illustratifs. Ni les positions des lampadaires, ni les états réels des logements, ni les horaires des monuments ne sont encore reproduits.

## Affichage cartographique des noms de rue : réglage discret

1. Ouvrir la vue d'ensemble du 4e : aucun nom de rue ne doit encombrer le paysage.
2. Zoomer vers une rue. Son nom doit apparaître seulement à proximité, petit, semi-transparent et posé visuellement sur la voie.
3. Continuer à zoomer : la police garde la même taille en pixels ; aucun texte ne s'étire.
4. Explorer un boulevard ou un long quai : le même nom peut réapparaître à plusieurs points, sans inventer de nouvelles voies.
5. Incliner, tourner et déplacer la caméra : l'étiquette suit sa position sur la rue.
6. Vérifier que plusieurs noms proches ne se chevauchent pas et ne passent pas sur les commandes.
7. Dézoomer : les étiquettes disparaissent progressivement sans modifier le nombre de bâtiments.
8. Vérifier que le compteur conserve les 205 voies officielles et que le jeu reste fluide (objectif 30 FPS minimum).

## Version 0.6 : matériaux et toitures issus de sources ouvertes

1. Vérifier l'affichage de « PROTOTYPE 06 » après actualisation.
2. Attendre les 2 696 bâtiments puis zoomer et dézoomer plusieurs fois. Le nombre doit rester identique.
3. Vérifier que le pied de page indique les murs et toits documentés. Les deux nombres attendus sont 1 315 et 1 334.
4. Sélectionner des bâtiments. Lire le matériau déclaré des gros murs, celui de couverture, la provenance et les réserves. Les valeurs inconnues doivent être affichées comme telles.
5. Repérer des différences visuelles entre couvertures de zinc, d'ardoise et de tuile. Les détails des fenêtres restent illustratifs.
6. Vérifier que certaines toitures d'origine OSM ont un volume non plat, sans dépasser la hauteur IGN. La ligne « forme de toiture » précise si sa pente est estimée.
7. Dans le 4e, 59 formes de toit ont été raccordées aux bâtiments IGN. Certaines sont très localisées et ne seront pas nécessairement visibles sur la première vue.
8. Observer la fluidité en qualité Moyenne puis Haute, au jour et à la nuit, avec une cible d'au moins 30 FPS.
9. Envoyer des captures de près et de loin avec l'indicateur FPS si des erreurs de façades, de toitures ou de sélection apparaissent.

## Correctif interface après les captures du 7 novembre

1. Vérifier que le bas de l'écran ne conserve plus qu'une seule ligne : nombre de bâtiments, FPS et bouton « Détails ».
2. Appuyer sur « Détails » pour retrouver l'ensemble des informations techniques et les crédits de sources, puis refermer.
3. Se placer à l'angle d'une rue, caméra inclinée. Une étiquette de rue masquée par un bâtiment doit disparaître au lieu de flotter sur sa façade.
4. Zoomer près d'une voie libre : son nom reste petit et discret, collé à sa position cartographique.
5. Compter 2 696 bâtiments quelle que soit la position de la caméra. L'objectif de fluidité reste au moins 30 FPS sur Android ; la visée observée était 58 à 60 FPS avant cette correction.

## Version 0.7 : disparition du glissement des noms de rues

1. Actualiser la page et vérifier la mention « PROTOTYPE 07 ».
2. Avancer près du pont Notre-Dame, du quai de Gesvres, de la rue Chanoinesse ou de la rue des Ursins.
3. Zoomer et dézoomer lentement 10 fois. Chaque nom doit rester au MÊME emplacement sur la rue, jamais sur une façade ni dans l'eau.
4. Tourner et incliner la caméra : l'inscription doit rester couchée sur la chaussée et naturellement masquée par un obstacle.
5. Regarder Paris de loin : les noms doivent disparaître. Revenir dans la rue : ils réapparaissent en petit, semi-transparents et sans cartouche.
6. Vérifier les noms répétés des voies longues, le compteur 2 696 bâtiments et l'objectif de 30 FPS sur le même téléphone.
7. Si un nom paraît déplacé, fournir deux captures du même endroit à deux zooms différents.

## Prototype 0.8 : photographie aérienne IGN et gestes intuitifs Android

1. Vérifier « PROTOTYPE 08 » et le compteur constant des 2 696 bâtiments.
2. Vérifier que les noms de rues ont entièrement disparu. Le fichier de noms reste en données internes pour une réintroduction future, mais aucun texte ne doit être dessiné.
3. Glisser avec un doigt vers le haut puis vers le bas : la carte doit suivre physiquement le doigt, comme une feuille que l'on déplace.
4. Tourner les deux doigts : le terrain doit réagir dans le même sens perceptible que la manipulation. Écarter / rapprocher pour zoomer / dézoomer, sans saut brutal.
5. Faire glisser deux doigts ensemble vers le haut : la caméra se rapproche d'une vue de l'horizon ; vers le bas : elle remonte vers la vue du dessus.
6. En mode photographie IGN, les routes, fleuve, ponts, végétation et toitures au sol proviennent du cliché aérien. Le volume 3D des bâtiments reste procédural et doit encore être amélioré.
7. Mesurer les FPS près d'une rue (qualités Moyenne et Haute), vérifier au moins 30 FPS. Vérifier la continuité des dalles en déplaçant la caméra.
8. Si la photographie ne s'affiche pas, ouvrir Détails : le jeu ne doit pas inventer de photo, un fond schématique de secours reste disponible.

## Prototype 0.9 : vrais retraits de volumes bâtis

1. Actualiser et vérifier la présence de « PROTOTYPE 09 ».
2. Explorer le 4e en qualité Haute près de l'Hôtel de Ville et de l'île Saint-Louis : davantage de bâtiments ont des niveaux en retrait et des toits de sections différents.
3. La géométrie doit rester stable pendant les zooms et rotations ; le compteur de 2 696 bâtiments ne doit pas varier.
4. Sélectionner des bâtiments : la ligne « Volumes » doit afficher le nombre de subdivisions municipales quand elles sont certifiées.
5. Vérifier que la photographie IGN reste bien au sol, sous les bâtiments, même lorsque les formes sont différentes.
6. Vérifier 30 FPS minimum sur Android récent en qualité Moyenne ; comparer aussi Haute en vue rapprochée.
7. Ne pas interpréter les étages de la Ville comme des mesures de toiture. Signaler si une toiture pénètre dans une autre ou si l'emprise d'un bâtiment est incomplète.

## Version 0.9 : vue de proximité

1. Appuyer sur Rue depuis le mode Carte : la caméra se rapproche progressivement du sol.
2. Utiliser les flèches tactiles maintenues : avancer, reculer, aller à droite ou à gauche selon l'orientation courante.
3. Glisser un doigt dans la vue Rue pour orienter le regard et l'incliner.
4. Appuyer sur Carte : retrouver une vue d'ensemble du même secteur.
5. Tester la sélection des bâtiments à proximité et mesurer la fluidité sur Android. La vue Rue ne gère pas encore les collisions avec les bâtiments.

## Prototype 0.9.1 : précision inspirée des city builders

1. Ouvrir l'aide « ? » et cocher « Mode précision ».
2. Avec un doigt, déplacer la carte : le mouvement doit être plus lent, sans inversion.
3. En vue Rue, glisser pour regarder et maintenir les flèches : les rotations et la vitesse doivent être réduites.
4. Vérifier le zoom et la rotation à deux doigts avec et sans le mode précision.
5. Garder le nombre total de 2 696 bâtiments et surveiller la fluidité Android.

## Prototype 0.10 : façades plus sobres et relief 3D

1. Actualiser la page jusqu'à lire « PROTOTYPE 0.10 ».
2. En qualité Haute, observer les façades du 4e de près. Vérifier que les baies sont moins massives et que les murs restent majoritaires.
3. Incliner la caméra pour examiner le bord des toits. Les bandeaux de corniche sont de petits volumes 3D, mais leur forme exacte est illustrative.
4. En qualité Basse, ces détails disparaissent. En revenant en Haute, ils réapparaissent à proximité, sans modifier le compteur des 2 696 bâtiments.
5. Comparer le FPS en qualité Moyenne puis Haute. Le seuil à respecter reste au moins 30 FPS sur le téléphone Android du joueur.
6. Vérifier l'orthophotographie IGN au sol, la sélection et les nouveaux volumes à étages du prototype 0.9.
7. Envoyer une capture rapprochée des toitures et façades si un relief paraît disproportionné.

## Prototype 0.11 : maquette monochrome et navigation à 360°

1. Voir « PROTOTYPE 0.11 » et les 2 696 bâtiments IGN.
2. Aucun fond satellite ni texture de façades, tout blanc ou gris. La Seine et les ponts sont des formes grises.
3. Tourner librement avec 360°, puis toucher Pan pour déplacer la carte.
4. Faire un tour complet de l'îlot en rotation. Vérifier les gestes dans toutes les orientations.
5. En vue Rue, faire glisser vers le haut pour lever le regard, sans traverser le sol. Les flèches déplacent la caméra.
6. Passer de Carte à Rue, puis de Rue à Carte sans saut. Zoomer/dézoomer, utiliser Nord et Recentrer.
7. Essayer les vitesses d'horloge. Aucun changement visuel de jour ou nuit ne doit se produire.
8. Comparer Moyen et Haut, objectif minimum 30 FPS. Contrôler la stabilité après plusieurs minutes.
