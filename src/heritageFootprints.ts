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
/* ---------------------------------------------------------------------
 * Contrôle géométrique réel (au-delà des boîtes englobantes).
 * La boîte n'est qu'un précontrôle rapide : une forme fausse peut avoir
 * la bonne boîte. On compare donc l'emprise IGN réelle (contour extérieur
 * MOINS les cours) à la projection horizontale des triangles de la
 * maquette, par échantillonnage régulier.
 * ------------------------------------------------------------------- */
export interface XZ{x:number;z:number;}
/** Polygone IGN projeté : [contour extérieur, ...cours]. */
export type FootprintPolygon=XZ[][];
export interface FootprintShape{box:Box2;polygons:FootprintPolygon[];}
export interface ModelShape{box:Box2;covers(x:number,z:number):boolean;}

function ringContains(ring:XZ[],x:number,z:number):boolean{
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const a=ring[i],b=ring[j];
  if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)inside=!inside;
 }
 return inside;
}
function inPolygons(polygons:FootprintPolygon[],x:number,z:number):boolean{
 return polygons.some(p=>p.length>0&&ringContains(p[0],x,z)&&
  !p.slice(1).some(h=>ringContains(h,x,z)));
}
function segDist2(px:number,pz:number,a:XZ,b:XZ):number{
 const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz;
 const t=l>0?Math.max(0,Math.min(1,((px-a.x)*dx+(pz-a.z)*dz)/l)):0;
 const ex=px-a.x-t*dx,ez=pz-a.z-t*dz;
 return ex*ex+ez*ez;
}
/** Index spatial des arêtes : test de proximité au bord en O(1) moyen. */
function edgeIndex(polygons:FootprintPolygon[],tol:number){
 const cell=Math.max(2,tol*4),grid=new Map<string,[XZ,XZ][]>();
 for(const p of polygons)for(const r of p)
  for(let i=0,j=r.length-1;i<r.length;j=i++){
   const a=r[j],b=r[i];
   const i0=Math.floor((Math.min(a.x,b.x)-tol)/cell),i1=Math.floor((Math.max(a.x,b.x)+tol)/cell);
   const j0=Math.floor((Math.min(a.z,b.z)-tol)/cell),j1=Math.floor((Math.max(a.z,b.z)+tol)/cell);
   for(let x=i0;x<=i1;x++)for(let z=j0;z<=j1;z++){
    const k=x+':'+z,l=grid.get(k)??[];l.push([a,b]);grid.set(k,l);
   }
  }
 const t2=tol*tol;
 return (x:number,z:number)=>{
  for(const [a,b] of grid.get(Math.floor(x/cell)+':'+Math.floor(z/cell))??[])
   if(segDist2(x,z,a,b)<=t2)return true;
  return false;
 };
}

export function footprintShape(polygons:FootprintPolygon[]):FootprintShape|null{
 let box:Box2|null=null;
 for(const p of polygons)for(const q of p[0]??[])
  box=unionBox(box,{minX:q.x,minZ:q.z,maxX:q.x,maxZ:q.z});
 return box?{box,polygons}:null;
}

/** Projection horizontale de la maquette : triangles indexés sur une grille.
 * Les triangles verticaux (murs) ont une projection nulle : la maquette doit
 * couvrir l'emprise par ses toitures et terrasses, comme le bâti réel. */
export function modelShapeFromParts(parts:{positions:ArrayLike<number>;
  indices:ArrayLike<number>}[],cell=4):ModelShape|null{
 let box:Box2|null=null;
 const tris:number[]=[];
 for(const part of parts){
  const b=boxOfPositions(part.positions);if(!b)return null;
  box=unionBox(box,b);
  const P=part.positions,I=part.indices;
  for(let k=0;k+2<I.length;k+=3){
   const ax=P[3*I[k]],az=P[3*I[k]+2],bx=P[3*I[k+1]],bz=P[3*I[k+1]+2],
    cx=P[3*I[k+2]],cz=P[3*I[k+2]+2];
   if(Math.abs((bx-ax)*(cz-az)-(cx-ax)*(bz-az))<1e-6)continue;
   tris.push(ax,az,bx,bz,cx,cz);
  }
 }
 if(!box)return null;
 const b0=box,grid=new Map<number,number[]>();
 const nx=Math.max(1,Math.ceil((b0.maxX-b0.minX)/cell)+1);
 const key=(i:number,j:number)=>i+j*nx;
 for(let t=0;t<tris.length;t+=6){
  const xs=[tris[t],tris[t+2],tris[t+4]],zs=[tris[t+1],tris[t+3],tris[t+5]];
  const i0=Math.floor((Math.min(...xs)-b0.minX)/cell),i1=Math.floor((Math.max(...xs)-b0.minX)/cell);
  const j0=Math.floor((Math.min(...zs)-b0.minZ)/cell),j1=Math.floor((Math.max(...zs)-b0.minZ)/cell);
  for(let i=i0;i<=i1;i++)for(let j=j0;j<=j1;j++){
   const list=grid.get(key(i,j))??[];list.push(t);grid.set(key(i,j),list);
  }
 }
 const covers=(x:number,z:number)=>{
  const i=Math.floor((x-b0.minX)/cell),j=Math.floor((z-b0.minZ)/cell);
  if(i<0||j<0||i>=nx)return false;
  for(const t of grid.get(key(i,j))??[]){
   const ax=tris[t],az=tris[t+1],bx=tris[t+2],bz=tris[t+3],cx=tris[t+4],cz=tris[t+5];
   const d1=(x-bx)*(az-bz)-(ax-bx)*(z-bz),d2=(x-cx)*(bz-cz)-(bx-cx)*(z-cz),
    d3=(x-ax)*(cz-az)-(cx-ax)*(z-az);
   const neg=d1<0||d2<0||d3<0,pos=d1>0||d2>0||d3>0;
   if(!(neg&&pos))return true;
  }
  return false;
 };
 return {box:b0,covers};
}

/** Tolérance de bord : écart admis entre le contour IGN généralisé et
 * la maquette. 1 m est un réglage prudent, à justifier par la précision
 * planimétrique publiée de chaque source avant une certification. */
export const POLYGON_EDGE_TOLERANCE_M=1;
export const POLYGON_MIN_COVERAGE=.95;
export const POLYGON_MAX_SPILL=.05;
export interface CoverageReport{coverage:number;spill:number;samples:number;ok:boolean;}
/** Couverture de l'intérieur de l'emprise (hors bande de tolérance) par la
 * maquette, et débordement de la maquette hors de l'emprise (cours fermées
 * comprises), rapporté à l'aire de l'emprise, mesuré sur toute la
 * surface de la maquette. Hors bande de tolérance seulement. */
export function polygonCoverage(model:ModelShape,footprints:FootprintShape[],
  maxSamples=10000):CoverageReport{
 const polygons=footprints.flatMap(f=>f.polygons);
 let zone:Box2|null=model.box;
 for(const f of footprints)zone=unionBox(zone,f.box);
 if(!zone||!polygons.length)return {coverage:0,spill:0,samples:0,ok:false};
 const tol=POLYGON_EDGE_TOLERANCE_M;
 const nearBoundary=edgeIndex(polygons,tol);
 const z0={minX:zone.minX-tol,minZ:zone.minZ-tol,maxX:zone.maxX+tol,maxZ:zone.maxZ+tol};
 const w=z0.maxX-z0.minX,h=z0.maxZ-z0.minZ;
 const step=Math.max(.25,Math.sqrt(w*h/maxSamples));
 let inside=0,interior=0,covered=0,spill=0,samples=0;
 for(let x=z0.minX+step/2;x<z0.maxX;x+=step)for(let z=z0.minZ+step/2;z<z0.maxZ;z+=step){
  samples++;
  const inFp=inPolygons(polygons,x,z);
  const m=model.covers(x,z);
  if(inFp)inside++;
  if(!m&&!inFp)continue;
  if(nearBoundary(x,z))continue;
  if(inFp){interior++;if(m)covered++;}
  else spill++;
 }
 if(!inside||!interior)return {coverage:0,spill:0,samples,ok:false};
 const coverage=covered/interior,spillRatio=spill/inside;
 return {coverage,spill:spillRatio,samples,
  ok:coverage>=POLYGON_MIN_COVERAGE&&spillRatio<=POLYGON_MAX_SPILL};
}

/** Ce que la bascule exige d'un maillage d'extrusion. */
export interface ProxyMesh{isVisible:boolean;isPickable:boolean;}
interface Registered<M>{ignId:string;shape:FootprintShape;mesh:M;}

/** Bascule extrusion IGN <-> maquette experte, par emprise.
 * Une emprise est masquée ssi au moins une référence active la couvre
 * et que la maquette de cette référence couvre bien cette emprise :
 * précontrôle par boîtes, puis contrôle sur les polygones réels. */
export class HeritageSwap<M extends ProxyMesh>{
 private meshes=new Map<string,Registered<M>[]>();
 private active=new Map<string,ModelShape>();
 private index:()=>FootprintIndex;
 private onReject:(ref:string,ignId:string)=>void;
 /** Dernier rapport de couverture par référence (diagnostic). */
 readonly reports=new Map<string,CoverageReport>();
 constructor(index:()=>FootprintIndex,
  onReject:(ref:string,ignId:string)=>void=()=>{}){
  this.index=index;this.onReject=onReject;
 }

 /** Appelé par la construction de tuile pour chaque maillage séparé. */
 register(ignId:string,mesh:M,shape:FootprintShape):void{
  const list=this.meshes.get(ignId)??[];
  list.push({ignId,shape,mesh});
  this.meshes.set(ignId,list);
  mesh.isPickable=true;
  // Tuile chargée APRÈS la maquette : revérifier avant de masquer.
  for(const ref of this.index().refsOf(ignId)){
   const model=this.active.get(ref);
   // Seule la couverture de la nouvelle emprise est revérifiée : le
   // débordement a été jugé à l'activation, toutes emprises chargées.
   if(model&&polygonCoverage(model,[shape]).coverage<POLYGON_MIN_COVERAGE){
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
 private shapesOf(ref:string):FootprintShape[]{
  const out:FootprintShape[]=[];
  for(const id of this.index().ignIdsOf(ref))
   for(const r of this.meshes.get(id)??[])out.push(r.shape);
  return out;
 }
 /** Vrai si toutes les emprises de la référence ont une extrusion chargée. */
 allLoaded(ref:string):boolean{
  const ids=this.index().ignIdsOf(ref);
  return ids.length>0&&ids.every(id=>this.meshes.has(id));
 }
 /** Emprise des extrusions actuellement chargées pour une référence,
  * ou null si aucune n'est chargée (rien à vérifier, rien à masquer). */
 footprintBox(ref:string):Box2|null{
  let box:Box2|null=null;
  for(const s of this.shapesOf(ref))box=unionBox(box,s.box);
  return box;
 }
 /** Contrôle D7 sans effet de bord : précontrôle par boîtes de chaque
  * emprise chargée, puis couverture réelle des polygones (cours
  * soustraites) et débordement limité. */
 accepts(ref:string,model:ModelShape):boolean{
  const shapes=this.shapesOf(ref);
  // Mémo : le même contrôle sert à la validation puis à l'activation.
  const memo=this.memo.get(model);
  if(memo&&memo.shapes.length===shapes.length&&
     memo.shapes.every((s,i)=>s===shapes[i]))return memo.ok;
  const ok=this.evaluate(ref,model,shapes);
  this.memo.set(model,{shapes,ok});
  return ok;
 }
 private memo=new WeakMap<ModelShape,{shapes:FootprintShape[];ok:boolean}>();
 private evaluate(ref:string,model:ModelShape,shapes:FootprintShape[]):boolean{
  if(!shapes.length)return false;
  // Toutes les emprises de la référence doivent être chargées : on ne
  // valide pas une maquette sur une partie seulement de ses emprises.
  if(!this.allLoaded(ref))return false;
  if(!shapes.every(s=>modelCoversFootprint(model.box,s.box)))return false;
  // Chaque emprise doit être couverte individuellement : une maquette ne
  // peut pas compenser une aile absente par une autre aile.
  if(shapes.length>1)for(const s of shapes){
   const r=polygonCoverage(model,[s]);
   if(r.coverage<POLYGON_MIN_COVERAGE){this.reports.set(ref,r);return false;}
  }
  const all=polygonCoverage(model,shapes);
  this.reports.set(ref,all);
  return all.ok;
 }
 /** À appeler APRÈS l'affichage de la maquette validée. */
 activate(ref:string,model:ModelShape):boolean{
  if(this.conflicts(ref)||!this.accepts(ref,model))return false;
  this.active.set(ref,model);
  this.refresh(ref);
  return true;
 }
 /** À appeler AVANT de détruire la maquette : l'extrusion revient. */
 deactivate(ref:string):void{
  if(!this.active.delete(ref))return;
  this.refresh(ref);
 }
 /** Vrai si une AUTRE référence active remplace déjà l'une des emprises
  * de celle-ci : deux maquettes complètes ne se superposent jamais. */
 conflicts(ref:string):boolean{
  return this.index().ignIdsOf(ref).some(id=>this.index().refsOf(id)
   .some(other=>other!==ref&&this.active.has(other)));
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
