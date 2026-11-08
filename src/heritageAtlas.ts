import {Color3,Mesh,MeshBuilder,Scene,Vector3} from '@babylonjs/core';
import type {Building} from './types';
import {project} from './geo';
import {terrainHeight} from './terrain';

interface Notice{
 ref:string;x:number;z:number;name:string;category?:string;
 protection?:string;date?:string;description?:string;sourceUrl:string;
}
export interface HeritageArea{
 id:string;name:string;kind:'garden'|'domain'|'monument';
 polygons:number[][][][];
 description:string;facts:string[];sourceUrl:string;
 geometryUrl:string;provenance:string;
}
interface HeritagePayload{schema:1;areas:HeritageArea[];}
const TILE=150;
const key=(x:number,z:number)=>Math.floor(x/TILE)+':'+Math.floor(z/TILE);
function ringContains(r:number[][],x:number,z:number):boolean{
 let inside=false;
 for(let i=0,j=r.length-1;i<r.length;j=i++){
  const a=r[i],b=r[j];
  if((a[1]>z)!==(b[1]>z)&&
    x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
 }
 return inside;
}
function inPolygons(polys:number[][][][],x:number,z:number):boolean{
 return polys.some(poly=>poly.length>0&&ringContains(poly[0],x,z)&&
   !poly.slice(1).some(r=>ringContains(r,x,z)));
}
function footprintContains(b:Building,x:number,z:number):boolean{
 return b.polygons.some(poly=>{
  const converted=poly.map(r=>r.map(p=>b.localCoordinates?p:
    Object.values(project(p)) as number[]));
  return converted.length>0&&ringContains(converted[0],x,z)&&
    !converted.slice(1).some(r=>ringContains(r,x,z));
 });
}
let singleton:HeritageAtlas|null=null;
/** Les liens exacts reposent sur un point POP à l'intérieur de l'emprise
 * IGN, et ne prouvent pas juridiquement la protection de tout le bâtiment.
 */
export function tagHeritageBuilding(b:Building):void{
 singleton?.tag(b);
}
/** Index patrimoine et domaines indépendants des tuiles graphiques.
 * Aucun clic ne lance d'énumération réseau, aucun objet n'est généré
 * chaque frame ; les parcs conservent leurs vrais sols et leurs arbres.
 */
export class HeritageAtlas{
 private grid=new Map<string,Notice[]>();
 private byRef=new Map<string,Notice>();
 private areas:HeritageArea[]=[];
 private lines:Mesh[]=[];
 constructor(private scene:Scene){singleton=this;}
 async init():Promise<void>{
  try{
   const res=await fetch(import.meta.env.BASE_URL+'data/metropole/places/monuments.json');
   if(res.ok){
    const body=await res.json() as {records:Notice[]};
    if(Array.isArray(body.records)){
     for(const n of body.records){
      if(!n.ref||!Number.isFinite(n.x)||!Number.isFinite(n.z))continue;
      this.byRef.set(n.ref,n);
      const bucket=this.grid.get(key(n.x,n.z))??[];
      bucket.push(n);this.grid.set(key(n.x,n.z),bucket);
     }
    }
   }
  }catch(e){console.warn('Notices Culture non disponibles',e);}
  try{
   const response=await fetch(import.meta.env.BASE_URL+
     'data/metropole/places/heritage-areas.json');
   if(response.ok){
    const doc=await response.json() as HeritagePayload;
    if(doc.schema===1&&Array.isArray(doc.areas)){
     this.areas=doc.areas.filter(a=>a.id&&a.name&&
       Array.isArray(a.polygons)&&a.polygons.length>0);
     this.drawBoundaries();
    }
   }
  }catch(e){console.warn('Domaines patrimoniaux facultatifs',e);}
 }
 private near(x:number,z:number):Notice[]{
  const result:Notice[]=[];
  const ix=Math.floor(x/TILE),iz=Math.floor(z/TILE);
  for(let dx=-1;dx<=1;dx++)for(let dz=-1;dz<=1;dz++)
   result.push(...(this.grid.get((ix+dx)+':'+(iz+dz))??[]));
  return result;
 }
 tag(b:Building):void{
  if(b.heritageRef)return;
  const bounds=b.polygons[0]?.[0];
  if(!bounds?.length)return;
  const corners=b.localCoordinates?bounds:bounds.map(p=>{
   const q=project(p);return [q.x,q.z];
  });
  const cx=corners.reduce((v,p)=>v+p[0],0)/corners.length;
  const cz=corners.reduce((v,p)=>v+p[1],0)/corners.length;
  for(const n of this.near(cx,cz)){
   if(Math.hypot(n.x-cx,n.z-cz)>125)continue;
   if(!footprintContains(b,n.x,n.z))continue;
   b.heritageRef=n.ref;
   b.heritageName=n.name;
   return;
  }
 }
 identify(x:number,z:number):HeritageArea|null{
  // La plus petite emprise est prioritaire : bâtiment dans un jardin.
  let result:HeritageArea|null=null,area=Infinity;
  for(const p of this.areas){
   if(!inPolygons(p.polygons,x,z))continue;
   const poly=p.polygons[0]?.[0]??[];
   const xs=poly.map(v=>v[0]),zs=poly.map(v=>v[1]);
   const measure=(Math.max(...xs)-Math.min(...xs))*
     (Math.max(...zs)-Math.min(...zs));
   if(measure<area){result=p;area=measure;}
  }
  return result;
 }
 appendDetails(target:HTMLElement,area:HeritageArea|null,ref?:string):void{
  if(!area&&!ref)return;
  const section=document.createElement('section');
  section.className='monument-notice';
  const heading=document.createElement('h3');
  heading.textContent=area?.name??this.byRef.get(ref??'')?.name??'Patrimoine documenté';
  section.append(heading);
  const add=(label:string,value?:string)=>{
   if(!value)return;
   const p=document.createElement('p');
   const strong=document.createElement('strong');
   strong.textContent=label+' : ';
   p.append(strong,document.createTextNode(value));section.append(p);
  };
  const source=(label:string,url?:string)=>{
   if(!url||!/^https:\/\/(?:[\\w-]+\\.)*(?:culture\\.gouv\\.fr|senat\\.fr|louvre\\.fr|openstreetmap\\.org)(?:\/|$)/.test(url))return;
   const p=document.createElement('p'),link=document.createElement('a');
   link.href=url;link.target='_blank';link.rel='noopener noreferrer';link.textContent=label;
   p.append(link);section.append(p);
  };
  if(area){
   add('Nature',area.kind==='garden'?'Jardin / domaine paysager':
     area.kind==='monument'?'Édifice ou ensemble patrimonial':'Domaine historique');
   add('Présentation',area.description);
   for(const fact of area.facts)add('Caractéristique documentée',fact);
   add('Emprise','Contour cartographique documenté ; les sols et plantations conservent leurs couches réelles.');
   add('Géométrie',area.provenance);
   source('Source institutionnelle',area.sourceUrl);
   source('Données géographiques OpenStreetMap',area.geometryUrl);
  }
  if(ref){
   const n=this.byRef.get(ref);
   if(n){
    add('Notice Culture',n.name);
    add('Dénomination',n.category);
    add('Protection recensée',n.protection);
    add('Datation',n.date);
    add('Description',n.description);
    add('Précaution','Le point de la notice est inclus dans l’emprise IGN ; cela ne démontre pas la protection de toutes ses parties.');
    source('Notice POP/Mérimée',n.sourceUrl);
   }
  }
  target.prepend(section);
 }
 private drawBoundaries():void{
  for(const area of this.areas){
   for(const rings of area.polygons)for(const ring of rings){
    if(ring.length<3)continue;
    const pts=ring.map(v=>new Vector3(v[0],terrainHeight(v[0],v[1])+.8,v[1]));
    if(pts.length&&Vector3.Distance(pts[0],pts[pts.length-1])>.02)
      pts.push(pts[0].clone());
    const mesh=MeshBuilder.CreateLines('contour-patrimoine-'+area.id,
     {points:pts},this.scene);
    mesh.color=new Color3(.78,.69,.54);
    mesh.isPickable=false;
    this.lines.push(mesh);
   }
  }
 }
}
