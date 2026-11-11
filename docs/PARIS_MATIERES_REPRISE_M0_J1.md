# PARIS Matières — reprise M0 et préparation J1

**État :** PR #14 uniquement, non publiée. La version accessible aux joueurs
reste 0.26.4. Le projet graphique est distinct de l'inventaire patrimonial R09,
dont les acquis sont préservés.

Cette étape reprend `docs/TRANSMISSION_OUTIL_CHATGPT.md` et
`docs/CONSIGNE_OUTIL_ENRICHISSEMENT.md` (11 novembre 2026), sans refaire
les exports livrés par Claude.

## Livré : ordonnanceur local M0

`scripts/paris_matieres.py` utilise le **catalogue réel** généré par
`scripts/export_units.py` et les appariements IGN existants pour créer
une file de travail déterministe. Chaque dalle de sol précède ses bâtiments.
Le pilote Notre-Dame précède les autres unités, puis les monuments majeurs,
puis les îlots du centre vers la périphérie. Une unité sans dalle n'est
jamais supprimée de la file.

Une unité n'est marquée « acceptée » que si son retour et son export de
base sont présents **et** que le contrôle `check_unit_return.check` réussit.
La file est reconstituée à chaque demande : pas de coche « terminé »
enregistrée sans preuve ni reprise après faux succès.

Commandes :

```bash
python scripts/export_units.py --catalogue
python scripts/paris_matieres.py doctor
python scripts/paris_matieres.py queue --limit 20
python scripts/paris_matieres.py prepare sol:-2_-1
python scripts/paris_matieres.py prepare bat:BATIMENT0000000305564422
python scripts/paris_matieres.py validate bat:BATIMENT0000000305564422
```

**Limite assumée :** M0 ne génère pas de textures, ne récupère pas de données
LiDAR et ne modifie pas le moteur. Les validations restent celles du contrat
d'échange déjà fourni par Claude. La commande `validate` échoue tant que
l'unité n'a pas été réellement enrichie et contrôlée.

## Livré : préparation technique du pilote Roofer J1

`scripts/paris_matieres_roofer.py` extrait **sans approximation** l'emprise
Lambert-93 de l'unité depuis `unite.json`. Il préserve les polygones
multiparties et les cours. Il produit un **GeoPackage EPSG:2154**, pour éviter
de présenter des coordonnées Lambert-93 comme du GeoJSON WGS84.

La commande `run`, encore dépendante d'un nuage LiDAR local, valide au
minimum son origine déclarée (identifiant IGN, licence, URL HTTPS,
identifiant de dalle, date d'acquisition) et son **SHA-256 réel** avant
d'appeler Roofer. Elle refuse explicitement les sources cartographiques
fermées. Aucune donnée LiDAR sous licence non documentée ne doit être utilisée.

Préparation :

```bash
python scripts/paris_matieres.py prepare bat:BATIMENT0000000305564422
python scripts/paris_matieres_roofer.py prepare bat:BATIMENT0000000305564422
```

### Acquisition automatisée de la dalle officielle (J1)

Le programme `scripts/paris_matieres_sources.py` exploite l'URL d'index
**WFS IGN** déjà enregistrée dans `unite.json`. Il exige une référence
de dalle exacte ; aucune correspondance approximative n'est autorisée.
Le mode normal interroge uniquement la métadonnée (sans télécharger le
nuage) :

```bash
python scripts/paris_matieres_sources.py bat:BATIMENT0000000305564422
```

Pour acquérir expressément **une seule dalle**, en respectant un plafond
de bande passante, utiliser :

```bash
python scripts/paris_matieres_sources.py bat:BATIMENT0000000305564422 \
  --telecharger --limite-mo 1024
```

Le fichier LAS/LAZ doit commencer par la signature `LASF` ; le
programme calcule une empreinte SHA-256, crée le fichier source
`LHD_FXX_0652_6862.source.json` et réutilise le cache uniquement si
l'empreinte et l'URL concordent. En cas de réponse invalide ou de
dépassement de quota, le téléchargement partiel est écarté. Le
téléchargement effectif dépend de l'accessibilité des serveurs IGN et de
l'existence de la dalle : **aucune acquisition réelle n'a été exécutée
ni attestée depuis cette session**.

La présence d'une URL dans le WFS officiel documente sa provenance,
mais ne suffit pas à conclure qu'un rendu 3D est géométriquement juste.
La reconstruction et ses erreurs doivent encore être mesurées.

Le pilote attendu est Notre-Dame, bâtiment
`BATIMENT0000000305564422`, dalle IGN
`LHD_FXX_0652_6862` (à obtenir légalement depuis l'index WFS IGN).
Un exemple **de structure** pour le manifeste du fichier téléchargé :

```json
{
  "id": "ign-lidar-hd",
  "url": "https://ADRESSE_OFFICIELLE_REELLE_DU_NUAGE.laz",
  "licence": "Licence Ouverte 2.0",
  "sha256": "REMPLACER_PAR_64_CARACTERES_HEXADECIMAUX_REELS",
  "dateAcquisition": "DATE_REELLE_D_ACQUISITION",
  "dalle": "LHD_FXX_0652_6862"
}
```

Ce texte est un **gabarit, pas un manifeste exploitable**. Le fichier source
n'est pas présent dans le dépôt et n'a pas été téléchargé ici. Après obtention
du fichier officiel, calculer son empreinte :

```bash
python scripts/paris_matieres_roofer.py checksum /chemin/LHD_FXX_0652_6862.laz
```

Puis consigner la véritable URL et l'empreinte dans le manifeste et exécuter :

```bash
python scripts/paris_matieres_roofer.py run \
  bat:BATIMENT0000000305564422 \
  --nuage /chemin/LHD_FXX_0652_6862.laz \
  --provenance /chemin/LHD_FXX_0652_6862.source.json
```

Dépendances gratuites : `shapely`, `fiona`, et un binaire `roofer`
installé et accessible dans le PATH. Le traitement ne passe pas par
le serveur public du jeu. Roofer accepte un LAS/LAZ et un GeoPackage,
et produit une étape CityJSONSequence.

**Important :** la réussite de Roofer n'est PAS un modèle final certifié :
l'état produit reste `intermediaire-non-valide`. Il manque la conversion
CityJSONSequence → GLB local de l'unité, la mesure RMS contre le LiDAR,
les niveaux de détail, les matériaux, les captures et le passage effectif
dans `scripts/check_unit_return.py`. Aucune toiture ou façade n'est
présentée comme reconstruite à ce stade.

## Tests et sécurité

- `tests/test_paris_matieres.py` : reprise, ordre des unités, cas sans
  dalle, identifiants sûrs, rejet des faux retours, absence de téléchargement ;
- `tests/test_paris_matieres_roofer.py` : emprises avec cour, EPSG:2154,
  origine LiDAR et empreinte, construction contrôlée de la commande Roofer ;
- `tests/test_paris_matieres_sources.py` : métadonnées WFS à dalle exacte,
  URL d'imagerie interdite refusée, intégrité du cache et aucun accès
  réseau dans les tests.

Commandes :

```bash
python -m unittest tests.test_paris_matieres tests.test_paris_matieres_roofer tests.test_paris_matieres_sources -v
```

Les outils refuseront les entrées incohérentes, au lieu de générer
des sorties paraissant « exactes ». La licence déclarée dans le manifeste
ne suffit cependant pas à authentifier juridiquement sa provenance :
une vérification par l'index officiel reste nécessaire.

## Suite technique

1. Récupérer le nuage LiDAR **réel** de la dalle Notre-Dame depuis l'index
   WFS, avec cache, licence et attribution ; vérifier classes 2/6.
2. Mesurer l'écart entre reconstruction Roofer LoD2.2 et nuage LiDAR.
   Si l'écart dépasse 0,30 m RMS, conserver la base ou rejeter le retour.
3. Convertir la géométrie en GLB dans le repère X est / Y haut / Z sud,
   générer LOD1/LOD2 et rapport de qualité **réellement mesuré**.
4. Valider le paquet avec `check_unit_return.py` ; inspecter sa
   silhouette, ses cours, sa continuité avec les bâtiments voisins.
5. Passer ensuite aux dalles de sol et à l'intégration isolée
   (sans toucher `main` ni la version publique).

**Verrous :** aucune fusion de PR #14, aucun changement de la version publique
ni annonce de 0.27 sans approbation expresse du propriétaire.

Lien du jeu actuel : https://meyameya677-sketch.github.io/Paris-le-jeu/
