/** Histoire localisée et contrôlée : faits sourcés de la Ville de Paris,
 * des Archives de Paris, du musée Carnavalet et de Paris Musées.
 * Un quartier non traité ne reçoit jamais un récit d'un autre quartier.
 */
export interface HistoryNote{summary:string;source:string;label:string;}
const notes:Record<string,HistoryNote>={
 'halles':{
  summary:"Les Halles sont un centre d’approvisionnement parisien depuis le XIIe siècle. Au XIXe, les pavillons de Baltard transforment les marchés en un vaste ensemble de métal et de verre. Le marché de gros est déplacé à Rungis à la fin des années 1960.",
  source:"https://archives.paris.fr/offre-pedagogique/ressources-pedagogiques/les-halles-de-paris--vie-et-transformations-dun-espace-economique-1135-1974",
  label:"Archives de Paris"},
 'bercy':{
  summary:"Ancien village en bord de Seine, Bercy se développe autour du négoce des vins. Au XIXe siècle, ses entrepôts et ses rails desservent un grand centre de stockage ; le parc actuel conserve des traces de cette activité.",
  source:"https://www.paris.fr/pages/au-parc-de-bercy-une-partie-de-campagne-chargee-d-histoire-24268",
  label:"Ville de Paris"},
 'chapelle':{
  summary:"La Chapelle fut un village distinct de Paris, organisé autour de l’église Saint-Denys. L’ancienne commune, qui existait sous ce nom de 1790 à 1860, est intégrée à Paris lors de l’extension de la capitale.",
  source:"https://www.paris.fr/pages/la-chapelle-a-d-abord-ete-un-village-aux-portes-de-paris-27270",
  label:"Ville de Paris"},
 'belleville':{
  summary:"Belleville fut un village de collines, de vignes et de moulins avant son rattachement à Paris en 1860. Le secteur est progressivement urbanisé, tout en conservant une mémoire populaire et ouvrière.",
  source:"https://www.paris.fr/pages/place-des-fetes-deux-siecles-de-transformation-7290",
  label:"Ville de Paris"},
 'batignolles':{
  summary:"Les Batignolles, ancien hameau devenu commune en 1830, sont rattachées à Paris en 1860. Le square des Batignolles, aménagé sous le Second Empire, témoigne de l’art des jardins paysagers de cette époque.",
  source:"https://www.paris.fr/pages/sept-choses-a-savoir-sur-le-square-des-batignolles-23593",
  label:"Ville de Paris"},
 'goutte-d-or':{
  summary:"Sur d’anciennes terres de vigne, la Goutte d’Or devient au XIXe siècle un quartier ouvrier lié aux activités industrielles et ferroviaires. Il accueille ensuite plusieurs générations de populations venues d’ailleurs.",
  source:"https://www.paris.fr/pages/jacky-fait-vivre-la-memoire-de-la-goutte-d-or-5308",
  label:"Ville de Paris"},
 'saint-gervais':{
  summary:"Ce secteur du Marais conserve une trame ancienne. Au XVIIe siècle, le quartier se couvre d’hôtels particuliers, d’églises et de grands ensembles religieux ; il est remanié par les percées urbaines des siècles suivants.",
  source:"https://parismusees.paris.fr/fr/publications/le-marais-lecture-urbaine",
  label:"Paris Musées"},
 'archives':{
  summary:"Le Marais s’urbanise dès le Moyen Âge puis devient un quartier aristocratique majeur au XVIIe siècle. Ses hôtels particuliers et son réseau de rues racontent plusieurs siècles de transformations.",
  source:"https://parismusees.paris.fr/fr/publications/le-marais-lecture-urbaine",
  label:"Paris Musées"},
 'montagne-sainte-genevieve':{
  summary:"Sur la montagne Sainte-Geneviève, le développement des écoles et des collèges médiévaux contribue à la naissance du quartier Latin. Le latin est alors la langue de l’enseignement universitaire.",
  source:"https://www.paris.fr/pages/les-archeologues-parisiens-revelent-2-000-ans-d-histoire-au-coeur-du-quartier-latin-31272",
  label:"Ville de Paris"},
 'sorbonne':{
  summary:"La rive gauche devient dès le Moyen Âge un lieu d’enseignement européen. De nombreux collèges apparaissent autour de l’Université de Paris, dont la Sorbonne, et structurent le quartier Latin.",
  source:"https://www.paris.fr/pages/les-archeologues-parisiens-revelent-2-000-ans-d-histoire-au-coeur-du-quartier-latin-31272",
  label:"Ville de Paris"},
 'grandes-carrieres':{
  summary:"Montmartre a conservé la mémoire de ses carrières, de ses moulins et de ses quartiers populaires. La butte joue un rôle central au début de la Commune de Paris, le 18 mars 1871.",
  source:"https://www.paris.fr/pages/les-150-ans-de-la-commune-les-lieux-emblematiques-2-5-16972",
  label:"Ville de Paris"},
 'clignancourt':{
  summary:"Le secteur de Montmartre conserve le souvenir de l’ancien village et de la butte. En mars 1871, la présence des canons de la Garde nationale sur ses hauteurs est un épisode déterminant des débuts de la Commune.",
  source:"https://www.paris.fr/pages/les-150-ans-de-la-commune-les-lieux-emblematiques-2-5-16972",
  label:"Ville de Paris"},
 'faubourg-saint-antoine':{
  summary:"Le faubourg Saint-Antoine est un ancien quartier d’artisans, particulièrement des métiers du bois et du meuble. Ses cours et passages rappellent l’activité d’ébénisterie et de menuiserie qui s’y développe.",
  source:"https://cdn.paris.fr/paris/2022/06/29/945dbdf4531f5aabb4c2f5aa79dfe465.pdf",
  label:"Ville de Paris — patrimoine du faubourg Saint-Antoine"},
 'picpus':{
  summary:"Le nom de Picpus vient d’un ancien village proche du faubourg Saint-Antoine, où était établi un ordre religieux connu sous ce nom. La mémoire de cette implantation subsiste dans la toponymie.",
  source:"https://www.paris.fr/pages/champs-elysees-cadet-picpus-connaissez-vous-l-origine-des-noms-de-ces-voies-parisiennes-7499",
  label:"Ville de Paris"}
};
function key(name:string):string{
 return name.normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLowerCase().replace(/[’']/g,'-').replace(/[^a-z0-9]+/g,'-')
  .replace(/^-|-$/g,'');
}
/** L'absence d'une chronique spécifique ne justifie pas une invention. */
export function neighborhoodHistory(name:string):HistoryNote|null{
 return notes[key(name)]??null;
}
/** Résumé général valable pour la seule histoire administrative des quartiers
 * parisiens ; il est explicitement présenté comme contexte général.
 */
export const administrativeParis:HistoryNote={
 summary:"Paris est divisé en 80 quartiers administratifs, quatre par arrondissement. Ce découpage est défini lors de la réorganisation de la capitale au XIXe siècle. L’histoire précise de ce secteur reste à documenter.",
 source:"https://opendata.paris.fr/explore/dataset/quartier_paris/",
 label:"Ville de Paris — limites administratives"
};
