import {priorityHeritageRole} from './heritagePriorities';
/** Rôle principal affiché : un monument peut cumuler plusieurs usages,
 * mais une seule teinte doit servir à identifier sa maquette.
 * Privilégier les références POP exactes, sans déduire un propriétaire
 * ou une fonction d'un voisinage géographique.
 */
export type HeritageRole='touristic'|'cultural'|'political'|'financial';
export function roleOfHeritage(
 ref:string|undefined,name:string,currentUse?:string
):HeritageRole{
 const official=priorityHeritageRole(ref);
 if(official)return official;
 // Les autres notices POP sont traitées comme monuments touristiques
 // génériques, et ne sont JAMAIS qualifiées de ministères par adresse.
 const use=(currentUse??'').toLowerCase();
 if(ref&&/^PA\d{8}$/.test(ref)){
  if(/(?:^|[; ])(?:ministère|sénat|présidence|assemblée nationale)/.test(use))
   return 'political';
  if(/banque de france|banque centrale|établissement bancaire/.test(use))
   return 'financial';
  if(/musée|bibliothèque|théâtre|opéra|conservatoire|galerie d.art/.test(use))
   return 'cultural';
 }
 // Les sites OSM ne sont classés que sur leur nom institutionnel exact,
 // lorsqu'une emprise vectorielle recouvre réellement le bâtiment.
 if(ref?.startsWith('osm:')){
  const normalized=name.trim().normalize('NFD')
   .replace(/[\u0300-\u036f]/g,'').toLowerCase();
  if(/^(palais de l.?elysee|hotel matignon|assemblee nationale|senat)$/.test(normalized))
   return 'political';
  if(/^(banque de france|palais brongniart)$/.test(normalized))
   return 'financial';
  if(/^(centre pompidou|opera bastille|philarmonie de paris|philharmonie de paris|fondation louis vuitton|institut du monde arabe|cite des sciences et de l.industrie)$/.test(normalized))
   return 'cultural';
 }
 return 'touristic';
}
export const heritageRoleLabel:Record<HeritageRole,string>={
 touristic:'Monument et patrimoine touristique',
 cultural:'Équipement culturel et artistique',
 political:'Institution politique ou administrative',
 financial:'Édifice économique, commercial ou financier'
};
