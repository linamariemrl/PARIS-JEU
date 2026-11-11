# Unités exportables — contrat avec l'outil d'enrichissement graphique

État : **branche de développement uniquement** (PR #14). Version publique inchangée : 0.26.4.
Le rendu du jeu n'est pas modifié par ce lot : il prépare l'échange avec un outil externe.

## Principe

Chaque bâtiment et chaque morceau de sol de la maquette devient une **unité propre** :
un dossier autonome, identifié de façon permanente, géoréférencé et sourcé.
On les soumet **une par une** (ou par zone) à un outil externe qui :

1. récupère lui-même les données satellites et aériennes **gratuites** listées dans l'unité ;
2. transforme la maquette de base en maquette réaliste (géométrie de toit, façades, textures, niveaux de détail) ;
3. renvoie un paquet enrichi, contrôlé par `scripts/check_unit_return.py` avant toute intégration.

```
jeu ──export_units.py──▶ unité de base ──▶ OUTIL EXTERNE ──▶ unité enrichie ──check_unit_return.py──▶ intégration
       (bat:/sol:)        unite.json + base.glb   (sources ouvertes)   unite.json + enrichi.glb       (lot suivant)
```

## Les unités

| Type | Identifiant | Nombre | Contenu |
|---|---|---|---|
| Bâtiment | `bat:<identifiant IGN BD TOPO>` | 289 771 (287 075 en métropole + 2 696 dans le 4e) | emprise, hauteur, usage, altitude du sol, protection patrimoniale, compléments du 4e (toit LiDAR HD, forme OSM, matériaux) |
| Sol | `sol:<ix>_<iz>`, dalle de 200 m | 5 674 (Paris + 29 communes limitrophes) | relief (grille 21 × 21, pas de 10 m), chaussées, eau, espaces verts découpés à la dalle, arbres municipaux, liste des bâtiments posés dessus |

Les identifiants IGN sont permanents. `versionBase` est l'empreinte de la géométrie de base :
si l'IGN met à jour un bâtiment, la version change et un enrichissement ancien est refusé comme périmé.

## Géoréférencement (commun à toutes les unités)

- Référentiel : **Lambert-93 (EPSG:2154)**, altitudes **NGF-IGN69**. Conversion vérifiée au millimètre contre pyproj.
- `ancre` : point (e, n, altitude) qui sert d'origine au repère local de l'unité.
- Repère local des `.glb` : **X = est, Y = haut, Z = sud**, en mètres (convention glTF, main droite).
  Un sommet local (x, y, z) correspond à E = ancre.e + x, N = ancre.n − z, altitude = ancre.altitude + y.
- On fournit aussi l'emprise en WGS84 (EPSG:4326) et la position dans le repère du jeu.

## Fichiers d'une unité

```
export/unites/bat/BATIMENT0000000305564422/
  unite.json   (schéma : schemas/unite-v1.schema.json)
  base.glb     glTF 2.0, extrusion plate de l'emprise IGN, faces orientées vers l'extérieur
export/unites/sol/-2_-1/
  unite.json
  base.glb     relief seul (surfaces et arbres en données dans unite.json)
export/unites/catalogue.json   index de toutes les unités (id, tuile, position, versionBase)
```

Tous les `base.glb` passent le validateur officiel Khronos (0 erreur, 0 avertissement).

## Commandes

```bash
python scripts/export_units.py --catalogue
```

```bash
python scripts/export_units.py --bat BATIMENT0000000305564422
```

```bash
python scripts/export_units.py --sol=-2_-1
```

```bash
python scripts/export_units.py --zone 2.3499,48.8530,150
```

```bash
python scripts/check_unit_return.py retours/bat/BATIMENT0000000305564422
```

Dépendance : `shapely >= 2.1` (triangulation contrainte et découpage des surfaces).
Sortie par défaut `export/unites/` (ignorée par git ; tout est régénérable à partir des données du dépôt).

## Sources gratuites fournies dans chaque unité (pointeurs, rien n'est téléchargé à l'export)

| id | Nature | Licence |
|---|---|---|
| `ign-bd-ortho` | orthophotographie 20 cm (requête WMS déjà cadrée sur l'unité) | Licence Ouverte 2.0 |
| `ign-ortho-irc` | infrarouge couleur 20 cm (végétation) | Licence Ouverte 2.0 |
| `ign-lidar-hd` | nuage de points classé (COPC) + MNT/MNS/MNH 50 cm ; noms des dalles 1 km et requête d'index WFS | Licence Ouverte 2.0 |
| `ign-bd-topo` | bâtiments vectoriels (altitudes sol/toit, usages) | Licence Ouverte 2.0 |
| `sentinel-2` | satellite 10 m multispectral | Copernicus, libre et gratuit |

L'index LiDAR HD a été interrogé en direct : il renvoie pour chaque dalle `url_npl` (nuage), `url_mnt`, `url_mns` et `url_mnh`.

**Interdit** : Google Earth / Maps / Street View, Apple Plans, Bing Maps, toute source sans licence explicite.
Le validateur de retour refuse toute source dont l'URL ou l'identifiant relève de ces services.

## Ce que l'outil doit renvoyer

Un dossier par unité :

- `unite.json` : la même unité (même `id`, même `versionBase`, même `ancre`), `etat: "enrichie"` et un bloc
  `enrichissement` : `outil`, `version`, `date`, `sources` (chacune avec `id`, `url`, `licence`, date d'acquisition),
  et en option `niveauxDeDetail` et `textures`.
- `enrichi.glb` : glTF 2.0 dans le **même repère local**, sommets déjà transformés (pas de rotation de nœud),
  textures intégrées au fichier.

Contrôles appliqués (`scripts/check_unit_return.py`) :

1. unité connue et version de base identique, sinon l'enrichissement est périmé ;
2. ancre inchangée ;
3. glTF 2.0 binaire valide ;
4. maquette contenue dans l'emprise (tolérance 3 m), pas enterrée de plus de 15 m ;
   avertissement si elle dépasse nettement la hauteur IGN ;
5. sources déclarées, sous licence ouverte autorisée, aucune source interdite ;
6. budget de poids : 8 Mo par bâtiment, 16 Mo par dalle de sol (affichage mobile).

## Limites actuelles (déclarées, non masquées)

- Le relief de base vient de la grille RGE ALTI de 200 m, interpolée : il est approximatif.
  L'outil doit le remplacer par le MNT LiDAR HD à 50 cm.
- La maquette de base d'un bâtiment est une extrusion plate : toit et façades sont à reconstruire par l'outil.
- L'intégration des unités enrichies dans le rendu du jeu (chargement par unité, niveaux de détail,
  repli sur la base) n'est pas encore faite. C'est le lot suivant, et il exige de conserver le mode maquette blanc/gris.
