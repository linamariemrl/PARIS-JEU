/** Etat facultatif de caméra dans le schéma de sauvegarde 1.
 * Les anciennes parties sans vue restent compatibles.
 */
export type GraphicQuality='low'|'medium'|'high';
export interface GameView{
 x:number;z:number;radius:number;alpha:number;beta:number;
 street:boolean;
 quality:GraphicQuality;
}
export function validateGameView(value:unknown):GameView{
 if(!value||typeof value!=='object')throw Error('Position sauvegardée invalide');
 const v=value as Partial<GameView>;
 if(typeof v.x!=='number'||!Number.isFinite(v.x)||Math.abs(v.x)>18000||
    typeof v.z!=='number'||!Number.isFinite(v.z)||Math.abs(v.z)>18000||
    typeof v.radius!=='number'||!Number.isFinite(v.radius)||
    v.radius<12||v.radius>26000||
    typeof v.alpha!=='number'||!Number.isFinite(v.alpha)||Math.abs(v.alpha)>1e9||
    typeof v.beta!=='number'||!Number.isFinite(v.beta)||v.beta<.1||v.beta>2.78||
    typeof v.street!=='boolean'||
    !['low','medium','high'].includes(v.quality??''))
  throw Error('Paramètres de vue incompatibles');
 return v as GameView;
}
