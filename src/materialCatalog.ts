/** Correspondances fiscales officielles Cerema (Dmatgm / Dmatto).
 * Matériaux de gros murs, PAS une analyse des parements visibles.
 * Les codes mixtes gardent les deux composantes dans l'inspecteur.
 */
export const WALL_MATERIALS = {
  '1':'pierre','2':'meulière','3':'béton','4':'brique',
  '5':'aggloméré','6':'bois'
} as const;
export const ROOF_MATERIALS = {
  '1':'tuile','2':'ardoise','3':'zinc/aluminium','4':'béton'
} as const;
export type WallSurface='wall-stone'|'wall-millstone'|'wall-concrete'|
  'wall-brick'|'wall-aggregate'|'wall-wood';
export type RoofSurface='roof-tile'|'roof-slate'|'roof-zinc'|'roof-concrete';
export const WALL_SURFACES:WallSurface[]=[
  'wall-stone','wall-millstone','wall-concrete','wall-brick','wall-aggregate','wall-wood'
];
export const ROOF_SURFACES:RoofSurface[]=[
  'roof-tile','roof-slate','roof-zinc','roof-concrete'
];
const WALL_INDEX:Record<string,WallSurface>={
  '1':'wall-stone','2':'wall-millstone','3':'wall-concrete',
  '4':'wall-brick','5':'wall-aggregate','6':'wall-wood'
};
const ROOF_INDEX:Record<string,RoofSurface>={
  '1':'roof-tile','2':'roof-slate','3':'roof-zinc','4':'roof-concrete'
};
export function decodeMaterial(code:string|undefined,roof:boolean):string[] {
  if(!code||!/^[0-9]{2}$/.test(code))return [];
  const d:Record<string,string>=roof?ROOF_MATERIALS:WALL_MATERIALS;
  return Array.from(new Set(Array.from(code).map(n=>d[n]).filter(Boolean)));
}
export function surfaceForCode(code:string|undefined,roof:true):RoofSurface|null;
export function surfaceForCode(code:string|undefined,roof:false):WallSurface|null;
export function surfaceForCode(code:string|undefined,roof:boolean):WallSurface|RoofSurface|null {
  if(!code||!/^[0-9]{2}$/.test(code))return null;
  const map=roof?ROOF_INDEX:WALL_INDEX;
  for(const digit of code)if(map[digit])return map[digit];
  return null;
}
export function describeMaterial(code:string|undefined,roof:boolean):string {
  const decoded=decodeMaterial(code,roof);
  if(!decoded.length)return 'matériau non documenté';
  return decoded.join(' et ')+(decoded.length>1?' (mixte)':'');
}
