import {Color3,Mesh,MeshBuilder,Scene,Vector3} from '@babylonjs/core';
import type {Building} from './types';
import {storyForMonument} from './monumentStories';
import {project} from './geo';
import {terrainHeight} from './terrain';

interface Notice{
 ref:string;x:number;z:number;name:string;category?:string;
 protection?:string;date?:string;description?:string;sourceUrl:string;
 currentUse?:string;address?:string;author?:string;
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
 private areaIndex=new Map<string,HeritageArea[]>();
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
     this.indexAreas();
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
 private indexAreas():void{
  this.areaIndex.clear();
  for(const a of this.areas){
   const all=a.polygons.flat(2);
   if(!all.length)continue;
   const xs=all.map(p=>p[0]),zs=all.map(p=>p[1]);
   const x0=Math.floor(Math.min(...xs)/TILE),x1=Math.floor(Math.max(...xs)/TILE);
   const z0=Math.floor(Math.min(...zs)/TILE),z1=Math.floor(Math.max(...zs)/TILE);
   if((x1-x0+1)*(z1-z0+1)>600)continue;
   for(let i=x0;i<=x1;i++)for(let j=z0;j<=z1;j++){
    const k=i+':'+j;
    const bucket=this.areaIndex.get(k)??[];
    bucket.push(a);
    this.areaIndex.set(k,bucket);
   }
  }
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
  // Un édifice complexe peut dépasser 250 m. Ne pas perdre sa notice
  // lorsqu'elle tombe dans une aile éloignée du centre de l'emprise.
  const xs=corners.map(q=>q[0]),zs=corners.map(q=>q[1]);
  const minX=Math.floor(Math.min(...xs)/TILE),maxX=Math.floor(Math.max(...xs)/TILE);
  const minZ=Math.floor(Math.min(...zs)/TILE),maxZ=Math.floor(Math.max(...zs)/TILE);
  const nearby:Notice[]=[];
  if((maxX-minX+1)*(maxZ-minZ+1)<150){
   for(let ix=minX;ix<=maxX;ix++)for(let iz=minZ;iz<=maxZ;iz++)
    nearby.push(...(this.grid.get(ix+':'+iz)??[]));
  }else nearby.push(...this.near(cx,cz));
  for(const n of nearby){
   if(!footprintContains(b,n.x,n.z))continue;
   b.heritageRef=n.ref;
   b.heritageName=n.name;
   return;
  }
  // Uniquement si un contour OSM de tourisme/monument couvre le
  // centre géométrique : une simple proximité ne suffit jamais.
  const site=this.identify(cx,cz);
  if(site?.kind==='monument'){
   b.heritageRef='osm:'+site.id;
   b.heritageName=site.name;
  }
 }
 identify(x:number,z:number):HeritageArea|null{
  // La plus petite emprise est prioritaire : bâtiment dans un jardin.
  let result:HeritageArea|null=null,area=Infinity;
  for(const p of this.areaIndex.get(key(x,z))??[]){
   if(!inPolygons(p.polygons,x,z))continue;
   const poly=p.polygons[0]?.[0]??[];
   const xs=poly.map(v=>v[0]),zs=poly.map(v=>v[1]);
   const measure=(Math.max(...xs)-Math.min(...xs))*
     (Math.max(...zs)-Math.min(...zs));
   if(measure<area){result=p;area=measure;}
  }
  return result;
 }
 /** Fiche de jeu : lecture immédiate en quelques lignes, pas un registre
  * cadastralo-technique. Aucune histoire n'est inventée depuis une étiquette
  * OSM ou une notice POP dépourvue de contenu historique.
  */
 appendDetails(target:HTMLElement,area:HeritageArea|null,
   ref?:string,building?:Building):void{
  const notice=ref?this.byRef.get(ref):undefined;
  const name=notice?.name??building?.heritageName??area?.name;
  if(!name)return;
  const story=storyForMonument(name)??(area?
    storyForMonument(area.name):null);
  const section=document.createElement('section');
  section.className='monument-notice heritage-game-card';
  const overview=document.createElement('div');
  overview.className='heritage-essential';
  const line=(label:string,value?:string)=>{
   if(!value?.trim())return;
   const p=document.createElement('p');
   const term=document.createElement('strong');
   term.textContent=label+' : ';
   p.append(term,document.createTextNode(value.trim()));
   overview.append(p);
  };
  const category=story?.type??notice?.category??(
   area?.kind==='garden'?'Jardin historique':
   area?.kind==='monument'?'Monument / site touristique':
   area?'Domaine historique':undefined);
  const period=story?.period??notice?.date;
  line('Type',category);
  line('Époque',period);
  if(notice?.address)line('Lieu',notice.address);
  if(notice?.author&&!story)line('Architecte / auteur',notice.author);
  section.append(overview);
  const heading=document.createElement('h3');
  heading.textContent='En quelques lignes';
  section.append(heading);
  const p=document.createElement('p');
  p.className='heritage-history';
  // Une notice peut être une liste de termes techniques, pas une histoire.
  const officialDescription=notice?.description?.trim();
  const description=officialDescription&&officialDescription.length>45?
   officialDescription:undefined;
  const fromArea=area?.description?.trim();
  const summary=story?.history??description??(
   fromArea&&!/dénomination ne constitue|désigné dans OpenStreetMap/i.test(fromArea)?
    fromArea:undefined);
  p.textContent=summary?
   (summary.length<=380?summary:summary.slice(0,377).replace(/\\s+\\S*$/,'')+'…'):
   'L’histoire de ce lieu n’est pas encore documentée avec assez de précision pour en proposer un résumé fiable.';
  section.append(p);
  const url=story?.sourceUrl??notice?.sourceUrl??area?.sourceUrl;
  if(url){
   try{
    const parsed=new URL(url);
    const allowed=['culture.gouv.fr','senat.fr','louvre.fr',
     'openstreetmap.org','notredamedeparis.fr','sainte-chapelle.fr',
     'toureiffel.paris','paris-arc-de-triomphe.fr',
     'sacre-coeur-montmartre.com'];
    if(parsed.protocol==='https:'&&allowed.some(domain=>
      parsed.hostname===domain||parsed.hostname.endsWith('.'+domain))){
     const link=document.createElement('a');
     link.href=parsed.href;link.target='_blank';link.rel='noopener noreferrer';
     link.className='heritage-source';
     link.textContent=story||notice?'Source historique':'Source cartographique';
     section.append(link);
    }
   }catch{/* URL non validée, ne pas afficher de lien externe. */}
  }
  target.replaceChildren(section);
 }
 private drawBoundaries():void{
  for(const area of this.areas){
   // Les petits édifices sont teints via les bâtiments IGN : ne pas
   // ajouter 2 000 draw calls en dessinant toutes les notices OSM.
   if(area.id!=='luxembourg'&&area.id!=='tuileries')continue;
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
