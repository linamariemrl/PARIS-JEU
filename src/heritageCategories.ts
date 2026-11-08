/** Classification documentaire pour les matériaux de la maquette 3D.
 * Éviter toute attribution politique/financière déduite du quartier.
 * La couleur concerne les volumes identifiés, jamais le sol ou les parcs.
 */
export type HeritageRole='cultural'|'political'|'financial';
const POLITICAL=new Set([
 'PA00086319', // Hôtel de Ville, gouvernance municipale
 'PA00088876', // Palais de l'Élysée
 'PA00088722', // Hôtel de Matignon
 'PA00088653', // Palais du Luxembourg, Sénat
 'PA00085993', // Domaine du Palais-Royal, institutions nationales
 'PA00088873', // Ministère de l'Intérieur
 'PA00085814', // Ministère de la Justice
 'PA00085791', // Cour des comptes
 'PA00085991'  // Palais de Justice
]);
const FINANCIAL=new Set([
 'PA00086010'  // Bourse, édifice historiquement financier
]);
export function roleOfHeritage(
 ref:string|undefined,name:string,currentUse?:string
):HeritageRole{
 if(ref&&POLITICAL.has(ref))return 'political';
 if(ref&&FINANCIAL.has(ref))return 'financial';
 const use=(currentUse??'').toLowerCase();
 if(ref&&/(banque de france|banque centrale|établissement bancaire)/.test(use))
  return 'financial';
 if(ref&&/(^|[; ])(ministère|sénat|présidence|assemblée nationale)/.test(use))
  return 'political';
 // Pour les lieux OSM identifiés par leur emprise réelle, limiter les
 // décisions de fonction au nom explicite d'une institution.
 if(ref?.startsWith('osm:')){
  if(/^banque de france\b/i.test(name))return 'financial';
  if(/^(palais de l.?elysée|hôtel matignon|assemblée nationale|sénat)$/i.test(name))
   return 'political';
 }
 return 'cultural';
}
export const heritageRoleLabel:Record<HeritageRole,string>={
 cultural:'Patrimoine culturel et touristique',
 political:'Institution politique ou administrative',
 financial:'Patrimoine financier'
};
