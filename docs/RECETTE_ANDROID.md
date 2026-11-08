# PARIS 0.25 — recette visuelle et fonctionnelle Android

## Environnement de référence
- Conserver le modèle de téléphone, la version Android, le navigateur
  ou l'APK et le niveau qualité dans chaque série.
- Tester chaque zone à **trois focales** : panorama, quartier, rue.
- Comparer la première visite et le retour dans un quartier déjà chargé.
- Notez les FPS minimum et moyen observés, les gels perceptibles, ainsi
  que les zones encore incomplètes. Le chiffre HUD ne mesure pas la
  fluidité tactile à lui seul.

## Parcours incontournables (ne jamais « valider » sur une seule vue)

1. **Seine et ponts** : suivre le fleuve du centre vers l'amont et
   l'aval ; absence de voiles triangulaires, eau/berges/ponts raccordés.
2. **Montmartre / Butte-aux-Cailles / Belleville** : observer les
   changements d'altitude, maisons alignées, chaussées sans déchirures.
3. **Tuileries / Luxembourg / Buttes-Chaumont / Bois de Vincennes** :
   vérifier parcs, arbres, emprises, teintes et densité des secteurs.
4. **Paris centre, bordure d'arrondissements, proche banlieue** :
   naviguer rapidement en panorama et revenir au zoom de rue ;
   aucune grande zone absente ni double géométrie de toit.
5. **Rotation et navigation** : 360°, zoom, déplacement continu, vue
   Rue, changement de qualité pendant les mouvements.
6. **Parties** : sauvegarder, changer de quartier et d'heure, fermer,
   rouvrir et vérifier focale/zoom, horloge, dossiers et finances ;
   exporter et importer le JSON, puis l'archive globale.
7. **Installations** : distinguer Chrome, PWA installée et APK ; ne pas
   supposer qu'ils partagent IndexedDB. Tester les transferts par JSON.

## Critères de réception
| Domaine | Attendu | Confirmation |
| --- | --- | --- |
| Bâtiments | Couverture de tous les secteurs IGN, précision croissante au zoom | ☐ |
| LOD | Pas de trou ni superposition lors des changements de distance | ☐ |
| Relief | Collines visibles, bâtiments ancrés, pas de mur vertical parasite | ☐ |
| Voirie/eau | Continuité des chaussées, ponts, quais et Seine, sans triangles | ☐ |
| Nature | Parcs et arbres géolocalisés visibles et raccordés | ☐ |
| Fluidité | Manipulation stable, sans blocage ni chute prolongée sur téléphone de test | ☐ |
| Jeu | Horloge, dossiers, budgets et sélections inchangés | ☐ |
| Sauvegardes | Fermeture/reprise et import-export y compris focale | ☐ |
| APK/PWA | Installation, démarrage, stockage et mise à jour identifiés | ☐ |

**État actuel : aucune case n'est présumée validée sur Android.**
Les tests CI vérifient la structure et la construction, non l'absence
de défauts en situation réelle.
