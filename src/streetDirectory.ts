/** Les noms proviennent de la liste officielle de la Ville de Paris.
 * La géométrie IGN/OSM de chaussée reste la seule preuve de présence d'une route.
 * Le rapprochement nom-point est indicatif : aucun tronçon n'est inventé.
 */
export interface OfficialStreet {
 id:string;streetId:string;name:string;kind:string;
 x:number;z:number;angle:number;length:number;
}
interface StreetDocument {
 schema:number;officialCount:number;labels:OfficialStreet[];
}
export function nearestStreet(streets:readonly OfficialStreet[],x:number,z:number,
 maxDistance=24):OfficialStreet|null{
 let best:OfficialStreet|null=null;
 let shortest=maxDistance;
 for(const street of streets){
  if(!street.name||!Number.isFinite(street.x)||!Number.isFinite(street.z)||
     !Number.isFinite(street.angle)||!Number.isFinite(street.length))continue;
  const theta=street.angle*Math.PI/180;
  const along=(x-street.x)*Math.cos(theta)+(z-street.z)*Math.sin(theta);
  const limited=Math.max(-street.length/2,Math.min(street.length/2,along));
  const rx=x-(street.x+limited*Math.cos(theta));
  const rz=z-(street.z+limited*Math.sin(theta));
  const distance=Math.hypot(rx,rz);
  if(distance<shortest){shortest=distance;best=street;}
 }
 return best;
}
export class StreetDirectory {
 private streets:OfficialStreet[]=[];
 async init():Promise<void>{
  try{
   const response=await fetch(import.meta.env.BASE_URL+'data/4e/street-names.json');
   if(!response.ok)return;
   const data=await response.json() as StreetDocument;
   if(data.schema!==1||data.officialCount<150||
     !Array.isArray(data.labels)||data.labels.length<150)return;
   this.streets=data.labels;
  }catch(error){console.warn('Répertoire officiel des rues indisponible',error);}
 }
 nearest(x:number,z:number):OfficialStreet|null{
  return nearestStreet(this.streets,x,z);
 }
}
