import type { Scene } from '@babylonjs/core';
import type { BuildingMaterials } from './buildings';

/** Compatibilité historique : aucune fenêtre, ni modulation temporelle du
 * rendu monochrome. Le module n'est pas chargé dans le jeu actuel.
 */
export function installNightWindows(
  _scene:Scene,_materials:BuildingMaterials
):(_night:number,_hour:number)=>void{
  return (_night:number,_hour:number)=>{};
}
