/** Le MNT IGN fournit des altitudes de terrain, pas des hauteurs de
 * planchers ou de tabliers. Un bâtiment/pont doit conserver une référence
 * verticale cohérente, même sur un terrain en pente.
 * Fonction pure pour tester la géométrie sans WebGL.
 */
export interface GroundPoint {x:number;z:number}
export function stableFoundation(points:readonly GroundPoint[],
 sample:(x:number,z:number)=>number):number{
 if(points.length===0)return 0;
 const stride=Math.max(1,Math.ceil(points.length/48));
 const samples:number[]=[];
 let cx=0,cz=0,count=0;
 for(let i=0;i<points.length;i++){
  const p=points[i];
  if(!Number.isFinite(p.x)||!Number.isFinite(p.z))continue;
  cx+=p.x;cz+=p.z;count++;
  if(i%stride===0){
   const y=sample(p.x,p.z);
   if(Number.isFinite(y))samples.push(y);
  }
 }
 if(!count)return 0;
 const middle=sample(cx/count,cz/count);
 if(Number.isFinite(middle))samples.push(middle);
 if(!samples.length)return 0;
 // Médiane robuste : un point aberrant sur le versant voisin ne peut
 // créer à lui seul un « mur montagne » sur toute une toiture.
 samples.sort((a,b)=>a-b);
 const mid=Math.floor(samples.length/2);
 return samples.length%2?samples[mid]:(samples[mid-1]+samples[mid])/2;
}
