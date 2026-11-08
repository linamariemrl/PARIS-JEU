import {neighborhoodHistory,administrativeParis,type HistoryNote} from './neighborhoodHistory';
interface StreetRecord{id:string;name:string;type:string;orig:string;history:string;
 opening:string;polygons:number[][][][];}
export interface QuarterRecord{name:string;arr?:number;polygons:number[][][][];}
interface IndexDoc{schema:1;streets:StreetRecord[];quarters:QuarterRecord[];}
type Bounds=[number,number,number,number];
interface SpatialRecord{street:StreetRecord;bounds:Bounds;area:number;}
function inRing(ring:number[][],x:number,z:number):boolean{
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];
  if((a[1]>z)!==(b[1]>z)&&x<(b[0]-a[0])*
     (z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}
function inside(polygons:number[][][][],x:number,z:number):boolean{
 return polygons.some(poly=>poly.length>0&&inRing(poly[0],x,z)&&
  !poly.slice(1).some(r=>inRing(r,x,z)));
}
function bbox(polygons:number[][][][]):Bounds|null{
 let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;
 for(const poly of polygons)for(const ring of poly)for(const v of ring){
  if(!Number.isFinite(v[0])||!Number.isFinite(v[1]))return null;
  a=Math.min(a,v[0]);b=Math.min(b,v[1]);
  c=Math.max(c,v[0]);d=Math.max(d,v[1]);
 }
 return Number.isFinite(a)?[a,b,c,d]:null;
}
export interface UrbanResult{
 street:StreetRecord|null;quarter:QuarterRecord|null;
 story:HistoryNote|null;streetHistory:string|null;streetSource:string|null;
}
const CELL=250;
function cell(ix:number,iz:number){return ix+':'+iz;}
export class UrbanAtlas{
 private byCell=new Map<string,SpatialRecord[]>();
 private large:SpatialRecord[]=[];
 private quarters:Array<{quarter:QuarterRecord;bounds:Bounds}>=[];
 private loaded=false;
 get ready(){return this.loaded;}
 get quartersReady(){return this.quarters.length===80;}
 quarterRecords():readonly QuarterRecord[]{return this.quarters.map(q=>q.quarter);}
 quarterAt(x:number,z:number):QuarterRecord|null{
  for(const item of this.quarters){
   const [a,b,c,d]=item.bounds;
   if(x>=a&&x<=c&&z>=b&&z<=d&&inside(item.quarter.polygons,x,z))
    return item.quarter;
  }
  return null;
 }
 quarterNames():string[]{return this.quarters.map(q=>q.quarter.name);}
 quarterAnchors():Array<{name:string;x:number;z:number}>{
  return this.quarters.map(({quarter,bounds})=>({name:quarter.name,
    x:(bounds[0]+bounds[2])/2,z:(bounds[1]+bounds[3])/2}));
 }
 async init():Promise<void>{
  try{
   // Un index de quartiers léger reste utilisable si l'API des rues
   // dépasse son délai ou échoue : la sélection ne dépend pas des voies.
   let doc:IndexDoc|null=null;
   try{
    const full=await fetch(import.meta.env.BASE_URL+
      'data/metropole/places/urban-places.json');
    if(full.ok){
     const value=await full.json() as IndexDoc;
     if(value.schema===1&&Array.isArray(value.streets)&&
        Array.isArray(value.quarters)&&value.quarters.length===80)
      doc=value;
    }
   }catch(error){console.warn('Index des voies indisponible',error);}
   if(!doc){
    const response=await fetch(import.meta.env.BASE_URL+
      'data/metropole/places/quarters.json');
    if(!response.ok)throw Error('Contours officiels des quartiers indisponibles');
    const light=await response.json() as {schema:number;quarters:QuarterRecord[]};
    if(light.schema!==1||!Array.isArray(light.quarters)||
       light.quarters.length!==80)
     throw Error('Atlas des 80 quartiers incomplet');
    doc={schema:1,streets:[],quarters:light.quarters};
   }
   let indexed=0;
   for(const street of doc.streets){
    // Construire l'index spatial en tranches pour conserver l'interactivité
    // Android pendant le premier chargement de l'atlas historique.
    if(++indexed%80===0)
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
    if(!street.name||!Array.isArray(street.polygons))continue;
    const bounds=bbox(street.polygons);
    if(!bounds)continue;
    const [x0,z0,x1,z1]=bounds;
    const item:SpatialRecord={street,bounds,area:(x1-x0)*(z1-z0)};
    const ix0=Math.floor(x0/CELL),ix1=Math.floor(x1/CELL);
    const iz0=Math.floor(z0/CELL),iz1=Math.floor(z1/CELL);
    if((ix1-ix0+1)*(iz1-iz0+1)>450){
     this.large.push(item);continue;
    }
    for(let ix=ix0;ix<=ix1;ix++)for(let iz=iz0;iz<=iz1;iz++){
     const k=cell(ix,iz),bucket=this.byCell.get(k)??[];
     bucket.push(item);this.byCell.set(k,bucket);
    }
   }
   for(const quarter of doc.quarters){
    const bounds=bbox(quarter.polygons);
    if(bounds)this.quarters.push({quarter,bounds});
   }
   this.loaded=this.byCell.size>0&&this.quarters.length===80;
   console.info('Atlas historique :',doc.streets.length,'voies',
     this.quarters.length,'quartiers');
  }catch(error){console.warn('Nomenclature officielle temporairement absente',error);}
 }
 identify(x:number,z:number):UrbanResult{
  const candidates=[
   ...(this.byCell.get(cell(Math.floor(x/CELL),Math.floor(z/CELL)))??[]),
   ...this.large
  ].filter(item=>{
   const [a,b,c,d]=item.bounds;
   return x>=a&&x<=c&&z>=b&&z<=d;
  }).sort((a,b)=>a.area-b.area);
  const street=candidates.find(({street})=>inside(street.polygons,x,z))?.street??null;
  const quarter=this.quarterAt(x,z);
  const note=quarter?(neighborhoodHistory(quarter.name)??administrativeParis):null;
  const fragments=[street?.orig,street?.history,street?.opening]
   .filter((v):v is string=>Boolean(v&&v.trim()));
  const streetHistory=fragments.length?
    fragments.join(' ').slice(0,500):null;
  return {street,quarter,story:note,streetHistory,
   streetSource:streetHistory?
    'https://opendata.paris.fr/explore/dataset/denominations-emprises-voies-actuelles/':null};
 }
}
