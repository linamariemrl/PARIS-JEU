/** Courts récits vérifiés, séparés des emprises IGN et des données OSM.
 * Aucun récit historique n'est généré à partir de la seule proximité.
 * Les textes sont des synthèses originales, les sources sont institutionnelles.
 */
export interface MonumentStory{
  period:string;
  type:string;
  history:string;
  sourceUrl:string;
}
const entries:Array<{match:RegExp;story:MonumentStory}>=[
  {match:/^(?:cathédrale\s+)?notre[- ]dame(?:\s+de\s+paris)?$/i,
    story:{
      type:'Cathédrale gothique',period:'À partir de 1163',
      history:'Le chantier de Notre-Dame commence en 1163 sous l’impulsion de l’évêque Maurice de Sully. Édifiée au cœur de l’île de la Cité, elle devient un grand monument de l’art gothique. Son architecture et ses décors ont été modifiés et restaurés au fil des siècles.',
      sourceUrl:'https://www.notredamedeparis.fr/comprendre/architecture/'
    }},
  {match:/^sainte[- ]chapelle$/i,story:{
    type:'Chapelle royale gothique',period:'1241–1248',
    history:'Saint Louis fait bâtir la Sainte-Chapelle dans son palais pour abriter les reliques de la Passion. Ses immenses verrières illustrent l’art gothique rayonnant. Le monument est restauré au XIXe siècle après les dommages subis pendant la Révolution.',
    sourceUrl:'https://www.sainte-chapelle.fr/decouvrir/histoire-de-la-sainte-chapelle'
  }},
  {match:/^tour\s+eiffel$/i,story:{
    type:'Tour métallique',period:'1887–1889',
    history:'Construite pour l’Exposition universelle de 1889, la tour est issue du projet porté par Gustave Eiffel, Maurice Koechlin, Émile Nouguier et Stephen Sauvestre. Achevée en un peu plus de deux ans, elle devient un emblème de Paris.',
    sourceUrl:'https://www.toureiffel.paris/fr/le-monument/histoire'
  }},
  {match:/^arc\s+de\s+triomphe(?:\s+de\s+l[’\']étoile)?$/i,story:{
    type:'Monument commémoratif',period:'1806–1836',
    history:'Napoléon Ier ordonne sa construction pour célébrer les armées françaises. Le monument est inauguré en 1836, après trente ans de travaux. Il est devenu l’un des grands lieux de mémoire nationale.',
    sourceUrl:'https://www.paris-arc-de-triomphe.fr/decouvrir/histoire-de-l-arc-de-triomphe'
  }},
  {match:/^jardin\s+du\s+luxembourg$/i,story:{
    type:'Jardin historique',period:'À partir du XVIIe siècle',
    history:'Marie de Médicis fait constituer le domaine du Luxembourg au début du XVIIe siècle. Le jardin change plusieurs fois de dessin et de dimensions, notamment sous Haussmann au XIXe siècle. Il est aujourd’hui géré par le Sénat.',
    sourceUrl:'https://jardin.senat.fr/histoire-patrimoine/histoire.html'
  }},
  {match:/^jardin\s+des\s+tuileries(?:\s*[—-].*)?$/i,story:{
    type:'Jardin historique',period:'1564 ; remanié en 1664',
    history:'Catherine de Médicis fait créer ce jardin en 1564 près du palais des Tuileries. André Le Nôtre le redessine à partir de 1664 pour Louis XIV. Ancien jardin royal, il devient ensuite un grand espace de promenade public.',
    sourceUrl:'https://www.louvre.fr/decouvrir/le-palais/du-jardin-royal-au-jardin-public'
  }},
  {match:/^palais\s+du\s+luxembourg(?:,.*)?$/i,story:{
    type:'Palais historique et siège du Sénat',period:'1615–1631',
    history:'Marie de Médicis commande le palais à Salomon de Brosse en 1615. D’abord résidence princière, il change plusieurs fois d’usage au fil des régimes. Il accueille aujourd’hui le Sénat.',
    sourceUrl:'https://www.senat.fr/connaitre-le-senat/patrimoine/lhistoire-du-palais-du-luxembourg.html'
  }},
  {match:/^(?:palais\s+du\s+)?louvre(?:\s+et\s+.*)?$/i,story:{
    type:'Ancien palais royal et musée',period:'Depuis la fin du XIIe siècle',
    history:'Le Louvre naît comme forteresse avant de devenir une résidence des rois de France. Agrandi durant plusieurs siècles, le palais devient musée en 1793. Ses bâtiments conservent les traces de ces transformations successives.',
    sourceUrl:'https://www.louvre.fr/se-former-et-transmettre/trouver-des-ressources/premiers-pas-au-louvre'
  }},
  {match:/^(?:basilique\s+du\s+)?sacr[ée][ -]c[œo]ur(?:\s+de\s+montmartre)?$/i,story:{
    type:'Basilique',period:'1875–1919',
    history:'La première pierre est posée en 1875 d’après les plans de Paul Abadie. Le chantier se prolonge sur plusieurs décennies. La basilique, construite au sommet de Montmartre, est consacrée en 1919.',
    sourceUrl:'https://www.sacre-coeur-montmartre.com/decouvrir/notre-histoire/les-grandes-etapes-de-la-construction/'
  }},
  {match:/^fontaine\s+m[ée]dicis$/i,story:{
    type:'Fontaine monumentale',period:'Vers 1630',
    history:'Marie de Médicis fait aménager cette fontaine inspirée des jardins italiens. Transformée au fil des siècles, elle est déplacée lors des travaux d’Haussmann au XIXe siècle. Elle reste un élément majeur du jardin du Luxembourg.',
    sourceUrl:'https://jardin.senat.fr/histoire-patrimoine/patrimoine/la-fontaine-medicis.html'
  }}
];
export function storyForMonument(name:string):MonumentStory|null{
  const normalized=name.trim().replace(/\s+/g,' ');
  return entries.find(entry=>entry.match.test(normalized))?.story??null;
}

/* Fiches ajoutées en 0.26.1 : références POP officielles vérifiées. */
const referenceStories:Record<string,MonumentStory>={
 'PA00089004':{
  type:'Opéra du Second Empire',period:'1861–1875',
  history:'Conçu par Charles Garnier sous Napoléon III, ce théâtre est inauguré le 5 janvier 1875. Son grand escalier et ses décors monumentaux incarnent le Paris du Second Empire.',
  sourceUrl:'https://www.operadeparis.fr/apropos/theatres-et-ateliers/palais-garnier'},
 'PA00088689':{
  type:'Ancienne gare et musée',period:'1900 ; musée en 1986',
  history:'Victor Laloux construit la gare d’Orsay pour l’Exposition universelle de 1900. Transformée après plusieurs décennies, elle ouvre comme musée en 1986.',
  sourceUrl:'https://www.musee-orsay.fr/fr/magazine/2024-12-19/de-la-gare-au-musee'},
 'PA00088714':{
  type:'Ensemble militaire',period:'Depuis 1670',
  history:'Louis XIV crée les Invalides en 1670 pour les soldats blessés ou âgés. L’ensemble accueille l’église du Dôme et, depuis 1840, le tombeau de Napoléon Ier.',
  sourceUrl:'https://www.musee-armee.fr/au-programme/350-ans-du-musee-de-larmee/lhotel-des-invalides-en-10-dates.html'},
 'PA00088877':{
  type:'Palais d’exposition',period:'1897–1900',
  history:'Édifié pour l’Exposition universelle de 1900, le Grand Palais associe pierre, métal et verre. Sa grande nef est devenue l’un des lieux majeurs de la vie culturelle parisienne.',
  sourceUrl:'https://www.grandpalais.fr/fr/node/1553'},
 'PA00088878':{
  type:'Musée des Beaux-Arts',period:'1900 ; musée en 1902',
  history:'Charles Girault conçoit le Petit Palais pour l’Exposition universelle de 1900. En 1902, il devient le musée des Beaux-Arts de la Ville de Paris.',
  sourceUrl:'https://www.petitpalais.paris.fr/explorer/le-petit-palais/lhistoire-du-petit-palais'},
 'PA00088420':{
  type:'Monument national',period:'XVIIIe siècle ; 1791',
  history:'Élevé comme église Sainte-Geneviève d’après le projet de Soufflot, l’édifice devient en 1791 un monument consacré aux grandes figures de la nation.',
  sourceUrl:'https://www.paris-pantheon.fr/decouvrir/histoire-du-pantheon'},
 'PA00086479':{
  type:'Ancien clocher',period:'XVIe siècle',
  history:'La tour est le clocher préservé de l’ancienne église Saint-Jacques-de-la-Boucherie. L’église a disparu après la Révolution ; la tour se dresse aujourd’hui dans un square.',
  sourceUrl:'https://www.paris.fr/lieux/tour-saint-jacques-5045'}
};
export function storyForReference(ref?:string):MonumentStory|null{
 return ref?referenceStories[ref]??null:null;
}
export const NEW_REFERENCE_STORIES=Object.keys(referenceStories).length;
