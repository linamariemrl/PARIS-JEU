/** Correspondance patrimoine <-> emprises IGN et bascule extrusion/maquette.
 *
 * R02-D3 : la table `heritage-footprints.json` est la SEULE source qui dit
 * quelles emprises IGN une maquette remplace. Plusieurs références peuvent
 * partager une emprise (ensemble et partie), une référence peut couvrir
 * plusieurs emprises. Aucune inférence géographique n'est faite ici.
 *
 * R02-D1/D2 : chaque emprise listée est construite en maillage propre
 * (voir `buildings.ts`). La remplacer revient à la rendre invisible
 * (`isVisible=false`) : le maillage reste activé et sélectionnable par un
 * prédicat de `scene.pick` qui ne teste pas `isVisible`. Aucune réécriture
 * d'indices, aucune allocation, réversible instantanément.
 *
 * R02-D7 : une emprise n'est masquée qu'après qu'une maquette validée a été
 * affichée ET que ses limites recouvrent l'emprise attendue.
 *
 * Ce module n'importe pas Babylon.js : il est testé sous Node.
 */

export interface FootprintEntry{
 ref:string;
 ignIds:string[];
 parts:unknown[];
 status:string;
}
export interface FootprintTable{schema:1;entries:FootprintEntry[];}
/** Boîte englobante horizontale en coordonnées de scène (mètres). */
export interface Box2{minX:number;minZ:number;maxX:number;maxZ:number;}

const REF=/^PA\d{8}$/;
const IGN=/^BATIMENT\d{16}$/;

/** Rejette toute entrée mal formée plutôt que de la deviner. */
export function parseFootprintTable(doc:unknown):FootprintTable{
 const d=doc as Partial<FootprintTable>|null;
 if(!d||d.schema!==1||!Array.isArray(d.entries))
  throw Error('Table des emprises patrimoniales invalide');
 const entries:FootprintEntry[]=[];
 const seen=new Set<string>();
 for(const e of d.entries){
  if(!e||typeof e.ref!=='string'||!REF.test(e.ref)||seen.has(e.ref)||
     !Array.isArray(e.ignIds)||!e.ignIds.every(id=>typeof id==='string'&&IGN.test(id))||
     !Array.isArray(e.parts)||typeof e.status!=='string')continue;
  seen.add(e.ref);
  entries.push({ref:e.ref,ignIds:[...new Set(e.ignIds)],parts:e.parts,status:e.status});
 }
 return {schema:1,entries};
}

/** Index plusieurs-à-plusieurs, immuable une fois construit. */
export class FootprintIndex{
 private byRef=new Map<string,string[]>();
 private byIgn=new Map<string,string[]>();
 constructor(table:FootprintTable={schema:1,entries:[]}){
  for(const e of table.entries){
   this.byRef.set(e.ref,e.ignIds.slice());
   for(const id of e.ignIds){
    const refs=this.byIgn.get(id)??[];
    if(!refs.includes(e.ref))refs.push(e.ref);
    this.byIgn.set(id,refs);
   }
  }
 }
 ignIdsOf(ref:string):readonly string[]{return this.byRef.get(ref)??[];}
 refsOf(ignId:string):readonly string[]{return this.byIgn.get(ignId)??[];}
 /** Vrai si l'emprise doit être construite en maillage séparé. */
 isTracked(ignId:string):boolean{return this.byIgn.has(ignId);}
 get size():number{return this.byIgn.size;}
}

let current=new FootprintIndex();
export function heritageFootprints():FootprintIndex{return current;}
export function setHeritageFootprints(index:FootprintIndex):void{current=index;}
/** À appeler AVANT la création des tuiles : une tuile construite sans la
 * table garde ses monuments fusionnés et ne sera jamais masquée. */
export async function loadHeritageFootprints(url:string):Promise<FootprintIndex>{
 try{
  const response=await fetch(url);
  if(!response.ok)throw Error('Table des emprises absente');
  current=new FootprintIndex(parseFootprintTable(await response.json()));
 }catch(error){
  console.warn('Emprises patrimoniales indisponibles : aucun remplacement',error);
  current=new FootprintIndex();
 }
 return current;
}

export function boxOfPositions(positions:ArrayLike<number>):Box2|null{
 let minX=Infinity,minZ=Infinity,maxX=-Infinity,maxZ=-Infinity;
 for(let i=0;i+2<positions.length;i+=3){
  const x=positions[i],z=positions[i+2];
  if(!Number.isFinite(x)||!Number.isFinite(z))return null;
  if(x<minX)minX=x;if(x>maxX)maxX=x;
  if(z<minZ)minZ=z;if(z>maxZ)maxZ=z;
 }
 return minX<=maxX?{minX,minZ,maxX,maxZ}:null;
}
export function unionBox(a:Box2|null,b:Box2|null):Box2|null{
 if(!a)return b;if(!b)return a;
 return {minX:Math.min(a.minX,b.minX),minZ:Math.min(a.minZ,b.minZ),
  maxX:Math.max(a.maxX,b.maxX),maxZ:Math.max(a.maxZ,b.maxZ)};
}
const area=(b:Box2)=>Math.max(0,b.maxX-b.minX)*Math.max(0,b.maxZ-b.minZ);

export const FOOTPRINT_TOLERANCE_M=2;
export const FOOTPRINT_MIN_COVERAGE=.8;
export const MODEL_MAX_DIAGONAL_M=600;
/** La maquette couvre-t-elle l'emprise IGN attendue ?
 * Au moins 80 % de la boîte de l'emprise doit tomber dans la boîte de la
 * maquette (tolérance 2 m), et la maquette ne peut pas dépasser 600 m de
 * diagonale. Une maquette décalée (mauvais repère, mauvaise référence)
 * est donc rejetée et l'extrusion IGN reste affichée. */
export function modelCoversFootprint(model:Box2,footprint:Box2):boolean{
 if(Math.hypot(model.maxX-model.minX,model.maxZ-model.minZ)>MODEL_MAX_DIAGONAL_M)
  return false;
 const t=FOOTPRINT_TOLERANCE_M;
 const ix=Math.min(model.maxX+t,footprint.maxX)-Math.max(model.minX-t,footprint.minX);
 const iz=Math.min(model.maxZ+t,footprint.maxZ)-Math.max(model.minZ-t,footprint.minZ);
 const covered=Math.max(0,ix)*Math.max(0,iz);
 const target=area(footprint);
 return target>0?covered/target>=FOOTPRINT_MIN_COVERAGE:
  ix>=0&&iz>=0;
}

/** Prédicat de sélection des bâtiments (R02-D2). Babylon n'applique pas
 * ses propres tests isEnabled/isVisible quand un prédicat est fourni :
 * on exige donc un maillage activé, sélectionnable et porteur des
 * métadonnées de tuile, SANS tester isVisible, pour que l'extrusion
 * IGN masquée sous une maquette experte reste le proxy de sélection. */
export function isBuildingPickProxy(mesh:{isPickable:boolean;isEnabled():boolean;
  metadata:unknown}):boolean{
  const m=mesh.metadata as {faceToBuilding?:unknown}|null|undefined;
  return mesh.isPickable&&mesh.isEnabled()&&Array.isArray(m?.faceToBuilding);
}
/** Ce que la bascule exige d'un maillage d'extrusion. */
export interface ProxyMesh{isVisible:boolean;isPickable:boolean;}
interface Registered<M>{ignId:string;box:Box2;mesh:M;}

/** Bascule extrusion IGN <-> maquette experte, par emprise.
 * Une emprise est masquée ssi au moins une référence active la couvre
 * et que la maquette de cette référence couvre bien cette emprise. */
export class HeritageSwap<M extends ProxyMesh>{
 private meshes=new Map<string,Registered<M>[]>();
 private active=new Map<string,Box2>();
 private index:()=>FootprintIndex;
 private onReject:(ref:string,ignId:string)=>void;
 constructor(index:()=>FootprintIndex,
  onReject:(ref:string,ignId:string)=>void=()=>{}){
  this.index=index;this.onReject=onReject;
 }

 /** Appelé par la construction de tuile pour chaque maillage séparé. */
 register(ignId:string,mesh:M,box:Box2):void{
  const list=this.meshes.get(ignId)??[];
  list.push({ignId,box,mesh});
  this.meshes.set(ignId,list);
  mesh.isPickable=true;
  // Tuile chargée APRÈS la maquette : vérifier l'emprise avant de masquer.
  for(const ref of this.index().refsOf(ignId)){
   const model=this.active.get(ref);
   if(model&&!modelCoversFootprint(model,box)){
    this.active.delete(ref);
    this.refresh(ref);
    this.onReject(ref,ignId);
   }
  }
  mesh.isVisible=!this.isReplaced(ignId);
 }
 /** Appelé à la destruction du maillage (tuile déchargée). */
 unregister(ignId:string,mesh:M):void{
  const list=this.meshes.get(ignId);
  if(!list)return;
  const rest=list.filter(r=>r.mesh!==mesh);
  if(rest.length)this.meshes.set(ignId,rest);else this.meshes.delete(ignId);
 }
 /** Emprise des extrusions actuellement chargées pour une référence,
  * ou null si aucune n'est chargée (rien à vérifier, rien à masquer). */
 footprintBox(ref:string):Box2|null{
  let box:Box2|null=null;
  for(const id of this.index().ignIdsOf(ref))
   for(const r of this.meshes.get(id)??[])box=unionBox(box,r.box);
  return box;
 }
 /** Contrôle D7 sans effet de bord : chaque emprise chargée de la
  * référence doit être couverte par la maquette. */
 accepts(ref:string,model:Box2):boolean{
  let any=false;
  for(const id of this.index().ignIdsOf(ref))
   for(const r of this.meshes.get(id)??[]){
    any=true;
    if(!modelCoversFootprint(model,r.box))return false;
   }
  return any;
 }
 /** À appeler APRÈS l'affichage de la maquette validée. */
 activate(ref:string,model:Box2):boolean{
  if(!this.accepts(ref,model))return false;
  this.active.set(ref,model);
  this.refresh(ref);
  return true;
 }
 /** À appeler AVANT de détruire la maquette : l'extrusion revient. */
 deactivate(ref:string):void{
  if(!this.active.delete(ref))return;
  this.refresh(ref);
 }
 isActive(ref:string):boolean{return this.active.has(ref);}
 isReplaced(ignId:string):boolean{
  return this.index().refsOf(ignId).some(ref=>this.active.has(ref));
 }
 private refresh(ref:string):void{
  for(const id of this.index().ignIdsOf(ref)){
   const hidden=this.isReplaced(id);
   for(const r of this.meshes.get(id)??[])r.mesh.isVisible=!hidden;
  }
 }
}
