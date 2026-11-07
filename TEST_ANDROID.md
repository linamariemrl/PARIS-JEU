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
