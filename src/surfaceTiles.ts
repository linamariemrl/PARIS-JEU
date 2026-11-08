import {
  Color3,Mesh,Scene,StandardMaterial,VertexData
} from '@babylonjs/core';
import earcut from 'earcut';
import {terrainHeight} from './terrain';

type Kind='managed'|'wood'|'planted'|'water'|'road';
type Quality='low'|'medium'|'high';
type Shape=[Kind,number[][][]];
type Level='near'|'far';
interface Tile{id:string;ix:number;iz:number;near:number;far:number;}
interface Manifest{schema:1;cellMeters:number;tiles:Tile[];sourceCounts:Record<string,number>;}
interface TileState{
  level:Level;meshes:Mesh[];lastUsed:number;
}
const ROOT=import.meta.env.BASE_URL+'data/metropole/surfaces/tiles/';
const KINDS:Kind[]=['managed','wood','planted','water','road'];
const RGB:Record<Kind,[number,number,number]>={
  managed:[.71,.77,.67],wood:[.51,.64,.51],
  planted:[.63,.73,.60],water:[.57,.69,.73],road:[.70,.69,.67]
};
// Le sol de base est y=0 ; décaler toutes les surfaces mesurées
// d'au moins 18 cm évite les artefacts z-buffer des longues vues.
const HEIGHT:Record<Kind,number>={
  managed:.18,wood:.19,planted:.20,water:.23,road:.27
};
interface Batch{pos:number[];idx:number[];count:number;}
function blank():Batch{return {pos:[],idx:[],count:0};}
function append(batch:Batch,rings:number[][][],kind:Kind,level:Level):void{
 const flat:number[]=[],holes:number[]=[];
 for(const ring of rings){
  if(!Array.isArray(ring)||ring.length<4)continue;
  const first=ring[0],last=ring[ring.length-1];
  const closed=Math.hypot(first[0]-last[0],first[1]-last[1])<.01;
  const points=closed?ring.slice(0,-1):ring;
  if(points.length<3)continue;
  if(flat.length)holes.push(flat.length/2);
  for(const p of points){
   if(!Number.isFinite(p[0])||!Number.isFinite(p[1]))return;
   flat.push(p[0],p[1]);
  }
 }
 if(flat.length<6)return;
 const indices=earcut(flat,holes,2);
 if(!indices.length)return;
 const start=batch.pos.length/3;
 for(let i=0;i<flat.length;i+=2)
  batch.pos.push(flat[i],HEIGHT[kind]+(level==='near'?.12:0)+
    terrainHeight(flat[i],flat[i+1]),flat[i+1]);
 for(const i of indices)batch.idx.push(start+i);
 batch.count++;
}
function createMesh(scene:Scene,kind:Kind,id:string,level:Level,
 batch:Batch,material:StandardMaterial):Mesh|null{
 if(batch.idx.length===0)return null;
 const mesh=new Mesh('sol-'+kind+'-'+id+'-'+level,scene);
 const vertex=new VertexData();
 vertex.positions=batch.pos;
 vertex.indices=batch.idx;
 // Surfaces horizontales : normales dirigées vers le haut.
 vertex.normals=Array.from({length:batch.pos.length/3},()=>[0,1,0]).flat();
 vertex.applyToMesh(mesh);
 mesh.material=material;
 mesh.isPickable=false;
 mesh.freezeWorldMatrix();
 return mesh;
}
/** Streaming SIG sectorisé. Proche: contours originaux; loin: contours
 * réels simplifiés. Ne jamais reconstruire l'intégralité de Paris sur
 * le fil GPU d'un téléphone.
 */
export class SurfaceTileManager{
 private manifest:Manifest|null=null;
 private states=new Map<string,TileState>();
 private fetching=new Set<string>();
 private errors=new Map<string,number>();
 private cache=new Map<string,Shape[]>();
 private materials:Record<Kind,StandardMaterial>;
 private quality:Quality='medium';
 private lastUpdate=0;
 private lastX=Infinity;
 private lastZ=Infinity;
 private lastRadius=Infinity;
 private status='';
 private pendingBuild=false;
 private overviewReady=false;
 private overviewMeshes:Mesh[]=[];
 private overviewShapes=new Map<string,Shape[]>();
 constructor(private scene:Scene,private onStatus:(s:string)=>void){
   this.materials={} as Record<Kind,StandardMaterial>;
   for(const kind of KINDS){
     const mat=new StandardMaterial('sol-SIG-'+kind,scene);
     mat.diffuseColor=new Color3(...RGB[kind]);
     mat.emissiveColor=new Color3(...RGB[kind]);
     // Couleur de matériau SIG indépendante des normales/tours de caméra.
     mat.disableLighting=true;
     mat.specularColor=Color3.Black();
     mat.backFaceCulling=false;
     mat.freeze();
     this.materials[kind]=mat;
   }
 }
 async init():Promise<void>{
   try{
     const response=await fetch(ROOT+'manifest.json');
     if(!response.ok)throw Error('Tuiles SIG non publiées');
     const result=await response.json() as Manifest;
     if(result.schema!==1||result.cellMeters!==2400||
       !Array.isArray(result.tiles)||result.tiles.length<20)
       throw Error('Index SIG incorrect');
     this.manifest=result;
     this.report();
     await this.loadOverview();
   }catch(error){
     console.warn('Sol SIG',error);
     this.onStatus('Sol sectorisé indisponible : voirie 4e conservée');
   }
 }
 /** Vue d'ensemble unique, cinq draw calls environ au lieu de
  * centaines de petits secteurs hors champ. Les formes proviennent
  * exclusivement des mêmes polygones officiels simplifiés.
  */
 private async loadOverview():Promise<void>{
   try{
     const response=await fetch(ROOT+'overview.json');
     if(!response.ok)throw Error('Vue surfacique fusionnée absente');
     const data=await response.json() as {
       schema:number;features:Array<[string,Kind,number[][][]]>
     };
     if(data.schema!==1||!Array.isArray(data.features)||
       data.features.length<300)throw Error('Vue surfacique incomplète');
     const batches={} as Record<Kind,Batch>;
     KINDS.forEach(kind=>batches[kind]=blank());
     for(let i=0;i<data.features.length;i++){
       const [tile,kind,rings]=data.features[i];
       if(!KINDS.includes(kind)||typeof tile!=='string')continue;
       const group=this.overviewShapes.get(tile)??[];
       group.push([kind,rings]);
       this.overviewShapes.set(tile,group);
       append(batches[kind],rings,kind,'far');
       if(i>0&&i%130===0)
         await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
     }
     this.overviewMeshes=KINDS.map(kind=>
       createMesh(this.scene,kind,'metropole','far',batches[kind],
         this.materials[kind])).filter((m):m is Mesh=>Boolean(m));
     this.overviewReady=this.overviewMeshes.length>0;
     // Les anciennes tuiles lointaines seraient coplanaires avec la
     // couche fusionnée : les détruire évite le scintillement noir.
     if(this.overviewReady){
       for(const [id,state] of this.states){
         if(state.level!=='far')continue;
         state.meshes.forEach(mesh=>mesh.dispose());
         this.states.delete(id);
       }
     }
     this.lastX=Infinity;
   }catch(error){
     console.warn('Surfaces fusionnées indisponibles, tuiles SIG conservées',error);
   }
   this.report();
 }
 setQuality(value:Quality){this.quality=value;this.lastX=Infinity;}
 update(x:number,z:number,radius:number,moving:boolean){
   if(!this.manifest)return;
   const now=performance.now();
   if(now-this.lastUpdate<300)return;
   const moved=Math.hypot(x-this.lastX,z-this.lastZ)>120||
      Math.abs(radius-this.lastRadius)>250;
   if(!moved&&now-this.lastUpdate<2000)return;
   this.lastX=x;this.lastZ=z;this.lastRadius=radius;this.lastUpdate=now;
   const range=Math.min(38000,Math.max(4000,radius*2.6));
   const nearRadius=Math.max(1800,Math.min(5800,radius*1.8));
   const list=this.manifest.tiles.filter(t=>
     Math.hypot((t.ix+.5)*2400-x,(t.iz+.5)*2400-z)<
        range+1600
   ).sort((a,b)=>{
     const dist=(v:Tile)=>Math.hypot((v.ix+.5)*2400-x,
        (v.iz+.5)*2400-z);
     return dist(a)-dist(b);
   });
   const nearBudget=this.quality==='low'?3:this.quality==='high'?8:5;
   let nearCount=0;
   const wants=new Map<string,Level>();
   for(const tile of list){
     const near=radius<4200&&
       Math.hypot((tile.ix+.5)*2400-x,(tile.iz+.5)*2400-z)<
       nearRadius+900&&nearCount<nearBudget;
     const target:Level=near?'near':'far';
     if(near)nearCount++;
     // La mosaïque officielle fusionnée dessine déjà toutes les zones
     // hors du détail local, sans autre texture ni téléchargement.
     if(this.overviewReady&&!near)continue;
     wants.set(tile.id,target);
     const state=this.states.get(tile.id);
     if(state&&state.level===target){
       state.lastUsed=now;continue;
     }
     if(moving&&state)continue; // jamais de bascule pendant le geste
     if(this.fetching.size>=1||this.pendingBuild)continue;
     if(now-(this.errors.get(tile.id)??-Infinity)<20000)continue;
     void this.load(tile,target);
   }
   for(const [id,state] of this.states){
     if(wants.has(id))continue;
     // Hors du champ élargi, on libère progressivement la mémoire GPU.
     if(now-state.lastUsed<9000)continue;
     state.meshes.forEach(m=>m.dispose());
     this.states.delete(id);
   }
   this.report();
 }
 private async load(tile:Tile,level:Level){
   const key=tile.id+'-'+level;
   if(this.fetching.has(key))return;
   this.fetching.add(key);
   try{
     let features=this.cache.get(key);
     if(!features){
       const response=await fetch(ROOT+key+'.json');
       if(!response.ok)throw Error('Tuile SIG '+key+' absente');
       const data=await response.json() as {schema:number;features:Shape[]};
       if(data.schema!==1||!Array.isArray(data.features))
         throw Error('Tuile SIG '+key+' invalide');
       features=data.features;
       this.cache.set(key,features);
       if(this.cache.size>16){
         const oldest=this.cache.keys().next().value;
         if(oldest)this.cache.delete(oldest);
       }
     }
     this.pendingBuild=true;
     const batches={} as Record<Kind,Batch>;
     KINDS.forEach(kind=>batches[kind]=blank());
     for(let i=0;i<features.length;i++){
       const feature=features[i];
       if(feature&&KINDS.includes(feature[0]))
         append(batches[feature[0]],feature[1],feature[0],level);
       if(i>0&&i%90===0)
         await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
     }
     // La vue métropolitaine fusionnée est désormais prioritaire.
     // Un ancien téléchargement far ne doit plus recréer une doublure.
     if(level==='far'&&this.overviewReady)return;
     // Construire les meshes hors animation ; remplacement sans frame vide.
     const meshes=KINDS.map(kind=>createMesh(this.scene,kind,tile.id,level,
       batches[kind],this.materials[kind])).filter((m):m is Mesh=>Boolean(m));
     const previous=this.states.get(tile.id);
     this.states.set(tile.id,{level,meshes,lastUsed:performance.now()});
     previous?.meshes.forEach(mesh=>mesh.dispose());
     this.errors.delete(tile.id);
   }catch(error){
     console.warn('Sol secteur',key,error);
     this.errors.set(tile.id,performance.now());
   }finally{
     this.fetching.delete(key);
     this.pendingBuild=false;
     this.lastX=Infinity;
     this.report();
   }
 }
 /** Classification d'un clic, seulement à partir d'emprises chargées.
  * Les contours provenaient d'IGN ou de Paris Data; le matériau exact
  * (asphalte/pavé) ne figure pas dans ces polygones.
  */
 identify(x:number,z:number):{kind:Kind;label:string;source:string}|null{
   const ix=Math.floor(x/2400),iz=Math.floor(z/2400);
   const tileId=ix+'_'+iz;
   const level=this.states.get(tileId)?.level;
   const shapes=(level&&this.cache.get(tileId+'-'+level))||
     this.overviewShapes.get(tileId);
   if(!shapes)return null;
   const inside=(ring:number[][]):boolean=>{
     let hit=false;
     for(let i=0,j=ring.length-1;i<ring.length;j=i++){
       const a=ring[i],b=ring[j];
       if(!a||!b)continue;
       if(((a[1]>z)!==(b[1]>z))&&
          x<(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0])hit=!hit;
     }
     return hit;
   };
   const found:Kind[]=[];
   for(const [kind,rings] of shapes){
     if(!rings[0]||!inside(rings[0]))continue;
     if(rings.slice(1).some(inside))continue;
     found.push(kind);
   }
   // Les chaussées peuvent empiéter sur un parc selon la précision SIG :
   // priorité à l'eau et aux voies pour qualifier le clic.
   const kind=(['water','road','planted','wood','managed'] as Kind[])
     .find(k=>found.includes(k));
   if(!kind)return null;
   const data={
    water:['Surface d’eau','IGN BD TOPO, emprise hydrographique'],
    road:['Chaussée','Ville de Paris, Plan de Voirie PVP'],
    planted:['Espace végétalisé inventorié','Ville de Paris, Espaces verts'],
    wood:['Bois ou espace forestier inventorié','Ville de Paris, Espaces verts'],
    managed:['Espace vert ou jardin inventorié','Ville de Paris, Espaces verts']
   } as Record<Kind,[string,string]>;
   return {kind,label:data[kind][0],source:data[kind][1]};
 }
 private report(){
   const msg=(this.overviewReady?'Vue d’ensemble SIG fusionnée + ':'')+
      this.states.size+' secteurs SIG chargés'+
      (this.fetching.size?' · géométrie en préparation':'')+
      (this.errors.size?' · '+this.errors.size+' erreurs temporaires':'');
   if(msg===this.status)return;
   this.status=msg;this.onStatus(msg);
 }
}
