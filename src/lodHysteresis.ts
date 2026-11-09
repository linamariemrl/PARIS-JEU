/** R02-D6 : choix du niveau de détail avec hystérésis.
 * Seuils montants (vers moins de détail) et descendants (vers plus de
 * détail) distincts, pour qu'une orbite à rayon proche d'un seuil ne
 * provoque pas d'allers-retours de chargement. Valeurs à calibrer sur
 * appareil ; elles encadrent les anciens seuils fixes 650 m et 1500 m.
 */
export type Tier='high'|'medium'|'low';
export const LOD_THRESHOLDS={
 highToMedium:700,mediumToHigh:600,
 mediumToLow:1600,lowToMedium:1400,
} as const;
export function chooseTier(radius:number,current?:Tier):Tier{
 const t=LOD_THRESHOLDS;
 switch(current){
  case 'high':return radius>t.mediumToLow?'low':radius>t.highToMedium?'medium':'high';
  case 'medium':return radius<t.mediumToHigh?'high':radius>t.mediumToLow?'low':'medium';
  case 'low':return radius<t.mediumToHigh?'high':radius<t.lowToMedium?'medium':'low';
  default:return radius<650?'high':radius<1500?'medium':'low';
 }
}
