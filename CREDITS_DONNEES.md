# Sources et licences
- Bâtiments et hauteurs : IGN, BD TOPO V3, Géoplateforme (service WFS), https://data.geopf.fr/wfs/ows
- Limites du 4e arrondissement : Ville de Paris, jeu « Arrondissements », ODbL, https://opendata.paris.fr/
- Ces données sont préparées par GitHub Actions, pas par le téléphone.
- Une hauteur manquante est une estimation signalée à l'écran, jamais présentée comme relevée.
- Vérifier les conditions de redistribution et les obligations d'attribution du millésime avant publication.

- Rues, chemins, zones piétonnes, ponts, surfaces en eau : © les contributeurs OpenStreetMap, données sous licence ODbL 1.0, https://www.openstreetmap.org/copyright
- Les emprises de chaussées et trottoirs sont reconstruites autour d'axes OSM. Les largeurs non renseignées sont estimées, tout comme la hauteur visuelle des tabliers des ponts.
- Si les surfaces d'eau sont indisponibles, un contour schématique peut être déduit d'un axe hydrographique réellement présent dans OSM. Cette approximation est signalée dans le jeu.
- Le fichier dérivé public/data/4e/infrastructure.json conserve la provenance, la date d'extraction, la licence et le statut des approximations.

- Arbres et positions : Ville de Paris, jeu de données « Arbres », licence ODbL. https://opendata.paris.fr/explore/dataset/les-arbres/
- La base municipale n'inclut pas tous les arbres de Paris, notamment les espaces privés et les bosquets ; elle n'est pas mise à jour en temps réel.
- Les formes des arbres et des façades sont des représentations graphiques produites pour le jeu, pas des relevés architecturaux ou botaniques détaillés.
- Les ponts 3D ont des hauteurs, profils et parapets provisoires. Seules les emprises et positions proviennent des données IGN.


- Noms et emprises des voies, au nombre de 205 pour le 4e : Ville de Paris, « Dénominations des emprises des voies actuelles », licence ODbL, https://opendata.paris.fr/explore/dataset/denominations-emprises-voies-actuelles/
- Les matériaux et motifs de fenêtres par catégorie d'usage sont des créations procédurales, pas un inventaire architectural exhaustif. Les matériaux précis des murs et des toitures demeurent non déterminés.

- Calcul de la position du Soleil et de la Lune à partir d'équations astronomiques simplifiées implémentées directement dans le jeu, sans service externe payant.
- Les constellations décoratives ne reproduisent pas un catalogue d'étoiles.
- Les lampadaires sont des éléments stylisés placés à partir des voies de Paris Data et ne correspondent pas à des positions vérifiées d'éclairage public.
- Les fenêtres allumées indiquent une hypothèse d'occupation par usage IGN, et ne permettent aucune inférence sur les occupants.

## Fidélité architecturale, sources envisagées

- Données de matériaux potentiellement présentes dans les attributs BD TOPO : `materiaux_des_murs`, `materiaux_de_la_toiture`, codes issus des fichiers fonciers. Les valeurs sont facultatives et leur couverture doit être auditée avant usage.
- Reconstruction des formes de toitures : LiDAR HD IGN, à exploiter dans une phase ultérieure avec contrôle de la qualité des dalles et de leur licence.
- Références de façades : photographies Panoramax, dont les licences varient selon l'instance ; attribution et droits de réutilisation à contrôler image par image.
- Aucun modèle, matériau ou relevé 3D du jeu ne doit être copié, extrait ou dérivé de Google Maps / Google Earth sans autorisation contractuelle explicite. L'API Google Maps 3D est facturable et incompatible avec le cahier de gratuité tel qu'établi.

## Matériaux de bâtiments et formes de toiture, version 0.6

- IGN BD TOPO, emprises, hauteurs, identifiants, codes « materiaux_des_murs » et « materiaux_de_la_toiture », Licence Ouverte 2.0. https://geoservices.ign.fr/bdtopo
- Cerema Datafoncier, correspondance des codes Dmatgm (matériaux des gros murs) et Dmatto (matériaux des toitures). https://doc-datafoncier.cerema.fr/doc/ff/pb40_pevprincipale/dmatgm
- © OpenStreetMap contributors, formes des toitures taguées roof:shape et hauteurs roof:height si présentes, licence ODbL 1.0. https://www.openstreetmap.org/copyright
- Ville de Paris, Volumes bâtis, licence ODbL, données de géométrie des parties en saillie et en retrait destinées à une intégration ultérieure. https://opendata.paris.fr/explore/dataset/volumesbatisparis/

Les motifs de matériaux sont des dessins procéduraux originaux produits pour le jeu. Ce ne sont ni des photographies réelles d'immeubles, ni des images dérivées de Google Maps. Les pentes des toitures sans hauteur OSM restent approximatives. Les toits sans forme connue ne sont pas reconstruits arbitrairement.

