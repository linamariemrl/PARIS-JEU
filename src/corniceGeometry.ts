/** Petit relief de couronnement illustratif.
 * Les contours proviennent d'emprises officielles ; les moulures 3D sont
 * une interprétation graphique et ne sont jamais annoncées comme relevées.
 * Le relief reste à l'intérieur de la hauteur totale du bâtiment IGN.
 */
export interface PlanPoint {x:number;z:number;}
export interface CorniceSegment {
  a:PlanPoint; b:PlanPoint;
  outA:PlanPoint;outB:PlanPoint;
  bottom:number;top:number;
}
export function polygonArea(ring:readonly PlanPoint[]):number{
  let a=0;
  for(let i=0;i<ring.length;i++){
    const p=ring[i],q=ring[(i+1)%ring.length];
    a+=p.x*q.z-q.x*p.z;
  }
  return a*.5;
}
export function corniceSegments(ring:readonly PlanPoint[],height:number):
  CorniceSegment[]{
  if(height<9||ring.length<3||ring.length>160)return [];
  const area=polygonArea(ring);
  if(Math.abs(area)<3)return [];
  const side=area>0?1:-1;
  const top=Math.max(0,height-.03);
  const bottom=Math.max(0,top-.22);
  const result:CorniceSegment[]=[];
  // Un profil ne doit pas empiéter exagérément sur les rues étroites.
  const offset=.14;
  for(let i=0;i<ring.length;i++){
    const a=ring[i],b=ring[(i+1)%ring.length];
    const dx=b.x-a.x,dz=b.z-a.z;
    const length=Math.hypot(dx,dz);
    if(length<3.5||!Number.isFinite(length))continue;
    const nx=side*dz/length, nz=-side*dx/length;
    result.push({
      a,b,
      outA:{x:a.x+nx*offset,z:a.z+nz*offset},
      outB:{x:b.x+nx*offset,z:b.z+nz*offset},
      top,bottom
    });
  }
  return result;
}
