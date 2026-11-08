import {Color3,Mesh,Scene,StandardMaterial,VertexData} from '@babylonjs/core';
import earcut from 'earcut';
import {terrainHeight} from './terrain';
import {appendDraped} from './reliefSurface';

/** Chaussées PVP de Paris entier : seule la géométrie officielle est rendue.
 * Une seule emprise lointaine, plus quelques tuiles exactes proches.
 * Aucun plan satellite, tracé routier inventé ni relief supplémentaire.
 */
type Ring=number[][];
type Polygon=Ring[];
type Shape=['managed'|'wood'|'planted'|'water'|'road',Polygon];
interface Tile {id:string;ix:number;iz:number;near:number;far:number;}
interface Manifest {schema:1;cellMeters:number;tiles:Tile[];sourceCounts:Record<string,number>;}
interface Batch {positions:number[];indices:number[];}
const ROOT=import.meta.env.BASE_URL+'data/metropole/surfaces/tiles/';
const CELL=2400;

function appendRoad(batch:Batch,rings:Polygon,height:number):void{
 const flat:number[]=[],holes:number[]=[];
 for(const raw of rings){
  if(!Array.isArray(raw)||raw.length<4)continue;
  const first=raw[0],last=raw[raw.length-1];
  const closed=Math.hypot(first[0]-last[0],first[1]-last[1])<.02;
  const points=closed?raw.slice(0,-1):raw;
  if(points.length<3)continue;
  if(flat.length)holes.push(flat.length/2);
  for(const point of points){
   if(!Number.isFinite(point[0])||!Number.isFinite(point[1])||
      Math.abs(point[0])>35000||Math.abs(point[1])>35000)return;
   flat.push(point[0],point[1]);
  }
 }
 if(flat.length<6)return;
 const triangles=earcut(flat,holes,2);
 if(!triangles.length)return;
 // Un niveau de détail précis du MNT évite que les grands triangles
 // PVP alternent dessus/dessous du sol et forment des traits noirs.
 appendDraped(batch,flat,triangles,terrainHeight,height,
   height<.6?170:105,height<.6?6500:10000);
}
function meshFor(scene:Scene,name:string,batch:Batch,material:StandardMaterial,
 pickable:boolean):Mesh|null{
 if(!batch.indices.length)return null;
 const mesh=new Mesh(name,scene);
 const data=new VertexData();
 data.positions=batch.positions;
 data.indices=batch.indices;
 data.normals=Array.from({length:batch.positions.length/3},()=>[0,1,0]).flat();
 data.applyToMesh(mesh);
 mesh.material=material;
 mesh.isPickable=pickable;
 mesh.freezeWorldMatrix();
 return mesh;
}

export class MetroRoads{
 private tiles:Tile[]=[];
 private ready=false;
 private overview:Mesh|null=null;
 private near=new Map<string,Mesh>();
 private fetching=new Set<string>();
 private failures=new Map<string,number>();
 private wanted=new Set<string>();
 private lastUpdate=0;
 private lastX=Infinity;
 private lastZ=Infinity;
 private radius=Infinity;
 private quality:'low'|'medium'|'high'='medium';
 private baseMaterial:StandardMaterial;
 private nearMaterial:StandardMaterial;
 constructor(private scene:Scene,private onStatus:(label:string)=>void){
  this.baseMaterial=new StandardMaterial('chaussees-PVP-lointaines',scene);
  this.baseMaterial.diffuseColor=new Color3(.57,.58,.59);
  this.baseMaterial.emissiveColor=new Color3(.57,.58,.59);
  this.baseMaterial.disableLighting=true;
  this.baseMaterial.backFaceCulling=false;
  this.baseMaterial.specularColor=Color3.Black();
  this.baseMaterial.zOffset=-1;
  this.baseMaterial.freeze();
  this.nearMaterial=new StandardMaterial('chaussees-PVP-proches',scene);
  this.nearMaterial.diffuseColor=new Color3(.51,.52,.53);
  this.nearMaterial.emissiveColor=new Color3(.51,.52,.53);
  this.nearMaterial.disableLighting=true;
  this.nearMaterial.backFaceCulling=false;
  this.nearMaterial.specularColor=Color3.Black();
  this.nearMaterial.zOffset=-3;
  this.nearMaterial.freeze();
 }
 setQuality(level:'low'|'medium'|'high'):void{
  this.quality=level;this.lastX=Infinity;
 }
 async init():Promise<void>{
  try{
   const response=await fetch(ROOT+'manifest.json');
   if(!response.ok)throw Error('Index des chaussées non publié');
   const manifest=await response.json() as Manifest;
   if(manifest.schema!==1||manifest.cellMeters!==CELL||
      !Array.isArray(manifest.tiles)||manifest.tiles.length<20||
      (manifest.sourceCounts?.roads??0)<10000)
    throw Error('Index PVP incomplet');
   this.tiles=manifest.tiles;
   this.ready=true;
   const far=await fetch(ROOT+'overview.json');
   if(!far.ok)throw Error('Couverture distante des rues absente');
   const file=await far.json() as {schema:number;features:Array<[string,Shape[0],Polygon]>};
   if(file.schema!==1||!Array.isArray(file.features)||
      file.features.length<300)throw Error('Rues lointaines incomplètes');
   const batch:Batch={positions:[],indices:[]};
   let processed=0;
   for(const [tile,kind,polygon] of file.features){
    if(kind!=='road'||typeof tile!=='string')continue;
    appendRoad(batch,polygon,.42);
    if(++processed%96===0)
     await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
   }
   this.overview=meshFor(this.scene,'routes-metropole-distantes',batch,
     this.baseMaterial,false);
   if(!this.overview)throw Error('Aucune chaussée PVP géométrique');
   this.onStatus('Chaussées Paris Data : '+processed.toLocaleString('fr-FR')+
     ' contours de loin + détails proches à la demande');
  }catch(e){
   console.warn('Voirie métropolitaine allégée indisponible',e);
   this.onStatus('Voirie du 4e conservée ; extension PVP indisponible');
  }
 }
 update(x:number,z:number,radius:number,moving:boolean):void{
  if(!this.ready||!this.overview)return;
  const now=performance.now();
  if(now-this.lastUpdate<450)return;
  const moved=Math.hypot(x-this.lastX,z-this.lastZ)>110||
   Math.abs(radius-this.radius)>160;
  if(!moved&&now-this.lastUpdate<1800)return;
  this.lastUpdate=now;this.lastX=x;this.lastZ=z;this.radius=radius;
  const budget=this.quality==='low'?2:this.quality==='high'?5:3;
  // La couverture simplifiée reste visible à distance ; les morceaux
  // étroits manquants au LOD sont complétés près de la caméra au repos.
  const nearby=radius<3500?this.tiles.filter(tile=>
   Math.hypot((tile.ix+.5)*CELL-x,(tile.iz+.5)*CELL-z)<
     Math.max(2400,radius*1.35)+1600).sort((a,b)=>{
      const distance=(t:Tile)=>Math.hypot((t.ix+.5)*CELL-x,(t.iz+.5)*CELL-z);
      return distance(a)-distance(b);
     }).slice(0,budget):[];
  this.wanted=new Set(nearby.map(t=>t.id));
  for(const [id,mesh] of this.near){
   if(this.wanted.has(id))continue;
   mesh.dispose();
   this.near.delete(id);
  }
  if(!moving&&this.fetching.size===0){
   const tile=nearby.find(t=>!this.near.has(t.id)&&
    !this.fetching.has(t.id)&&now-(this.failures.get(t.id)??-Infinity)>20000);
   if(tile)void this.loadNear(tile);
  }
 }
 private async loadNear(tile:Tile):Promise<void>{
  this.fetching.add(tile.id);
  try{
   const result=await fetch(ROOT+tile.id+'-near.json');
   if(!result.ok)throw Error('Chaussée PVP manquante '+tile.id);
   const file=await result.json() as {schema:number;features:Shape[]};
   if(file.schema!==1||!Array.isArray(file.features))throw Error('Tuile PVP invalide');
   const batch:Batch={positions:[],indices:[]};
   for(let i=0;i<file.features.length;i++){
    const record=file.features[i];
    if(record?.[0]==='road')appendRoad(batch,record[1],.74);
    if(i>0&&i%72===0)
     await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
   }
   if(!this.wanted.has(tile.id))return;
   const mesh=meshFor(this.scene,'routes-metropole-proches-'+tile.id,
    batch,this.nearMaterial,true);
   if(mesh)this.near.set(tile.id,mesh);
   this.failures.delete(tile.id);
  }catch(e){
   console.warn('Chaussées sectorisées',tile.id,e);
   this.failures.set(tile.id,performance.now());
  }finally{
   this.fetching.delete(tile.id);
   this.lastX=Infinity;
  }
 }
}
