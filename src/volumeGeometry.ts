/** La Ville de Paris fournit des emprises de volumes et des nombres de niveaux,
 * PAS des altitudes de toit. Le calcul ci-dessous reconstruit un étagement
 * purement indicatif, sans dépasser la hauteur totale IGN.
 */
export function steppedHeight(total:number,floors:number,maxFloors:number):number {
  if(!Number.isFinite(total)||total<=2)return Math.max(2,total||2);
  if(!Number.isFinite(floors)||!Number.isFinite(maxFloors)||
     floors<=0||maxFloors<=0)return total;
  const step=Math.min(4,Math.max(2.45,total/maxFloors));
  const difference=Math.max(0,maxFloors-floors);
  return Math.min(total,Math.max(2.5,total-difference*step));
}
export function shouldUseVolumes(coverage:number,parts:number,
                                  hasDocumentedRoof:boolean):boolean {
  return !hasDocumentedRoof&&parts>=2&&coverage>=.90&&coverage<=1.01;
}
