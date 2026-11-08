import {Color3,Color4,Mesh,MeshBuilder,Scene,StandardMaterial} from '@babylonjs/core';

import {terrainHeight} from './terrain';

const PREFIX=import.meta.env.BASE_URL+'data/metropole/overview/';
interface TileRef {id:string;ix:number;iz:number;offset:number;count:number;}
interface Group {
 id:string;gx:number;gz:number;count:number;bytes:number;tiles:TileRef[];
}
interface Manifest {
 schema:2;tileMeters:number;cellsPerGroup:number;quantizationMeters:number;
 totalBuildings:number;source:string;geometry:string;
 sourceHash?:string;groups:Group[];
}
interface VisibleGroup {
 mesh:Mesh;
 roof:Mesh;
 buffer:Float32Array;
 roofBuffer:Float32Array;
 bytes:DataView;
 group:Group;
}
const retryAfterMs=15_000;

/** Toutes les enveloppes de bâtiments disponibles restent visibles à
 * chaque échelle : instances simplifiées éloignées, emprises exactes
 * pour les tuiles proches. Les enveloppes ne sont pas des toits LiDAR.
 *
 * Les groupes téléchargés restent en mémoire; jamais de suppression
 * pendant le zoom, le panoramique ou une rotation à 360 degrés.
 */
export class MetroOverview {
 private manifest:Manifest|null=null;
 private byTile=new Map<string,Group>();
 private loaded=new Map<string,VisibleGroup>();
 private inFlight=new Set<string>();
 private failures=new Map<string,number>();
 private detailed=new Set<string>();
 private currentCount=0;
 private overviewMaterial:StandardMaterial;
 private roofMaterial:StandardMaterial;
 private roofOnly=false;
 private lastZoomMotion=0;
 private lastUpdate=0;
 private lastX=Infinity;
 private lastZ=Infinity;
 private lastRadius=Infinity;
 constructor(
  private scene:Scene,
  private onStatus:(label:string,count:number)=>void
 ){
   // Matériau unique pour toutes les silhouettes éloignées.
   // Teintes de face directement dans la géométrie, aucune texture.
   this.overviewMaterial=new StandardMaterial('volume-eloigne-pierre',scene);
   this.overviewMaterial.diffuseColor=Color3.White();
   this.overviewMaterial.specularColor=Color3.Black();
   this.overviewMaterial.freeze();
   this.roofMaterial=new StandardMaterial('toits-ign-lointains',scene);
   this.roofMaterial.diffuseColor=new Color3(.64,.68,.71);
   this.roofMaterial.specularColor=Color3.Black();
   this.roofMaterial.backFaceCulling=false;
   this.roofMaterial.freeze();
 }
 async init():Promise<void>{
  try{
   const response=await fetch(PREFIX+'manifest.json');
   if(!response.ok)throw Error('Aperçu métropolitain non généré');
   const m=await response.json() as Manifest;
   if(m.schema!==2||m.totalBuildings<15000||
      m.geometry!=='oriented-box-approximation'||m.quantizationMeters!==.25||
      m.tileMeters!==800||m.cellsPerGroup!==4||
      !Array.isArray(m.groups)||m.groups.length<10)
    throw Error('Manifest de représentation distante invalide');
   const total=m.groups.reduce((sum,g)=>sum+g.count,0);
   if(total!==m.totalBuildings)throw Error('Effectifs d’aperçu incohérents');
   for(const group of m.groups){
    if(group.bytes!==group.count*12||
       group.tiles.reduce((sum,t)=>sum+t.count,0)!==group.count)
     throw Error('Groupe d’aperçu invalide '+group.id);
    for(const tile of group.tiles){
     if(this.byTile.has(tile.id))throw Error('Tuile d’aperçu doublonnée');
     this.byTile.set(tile.id,group);
    }
   }
   this.manifest=m;
   this.report();
  }catch(error){
   console.warn('Aperçu distant non disponible, géométrie détaillée conservée',error);
   this.onStatus('Silhouettes distantes indisponibles ; bâtiments proches conservés',0);
  }
 }

 hasTile(id:string):boolean{
  const group=this.byTile.get(id);
  return Boolean(group&&this.loaded.has(group.id));
 }

 /** Masque exactement les silhouettes d'une tuile détaillée, sans
  * double rendu ni scintillement entre les deux niveaux géométriques.
  */
 setDetailed(id:string,enabled:boolean):void{
  const previous=this.detailed.has(id);
  if(previous===enabled)return;
  if(enabled)this.detailed.add(id);
  else this.detailed.delete(id);
  const group=this.byTile.get(id);
  const state=group&&this.loaded.get(group.id);
  const tile=group?.tiles.find(t=>t.id===id);
  if(!state||!tile)return;
  this.writeTile(state.buffer,state.bytes,tile,enabled);
  this.writeRoofTile(state.roofBuffer,state.bytes,tile,enabled);
  state.mesh.thinInstanceBufferUpdated('matrix');
  state.roof.thinInstanceBufferUpdated('matrix');
  // Bornes de rendu conservatrices établies à la première création :
  // recalculer à chaque changement serait très coûteux sur Android.
  this.currentCount+=enabled?-tile.count:tile.count;
  this.report();
 }

 update(x:number,z:number,radius:number):void{
  const m=this.manifest;
  if(!m)return;
  const now=performance.now();
  if(now-this.lastUpdate<190)return;
  const moving=Math.hypot(x-this.lastX,z-this.lastZ)>120||
   Math.abs(radius-this.lastRadius)>120;
  if(Math.abs(radius-this.lastRadius)>80)this.lastZoomMotion=now;
  if(!moving&&this.inFlight.size>0)return;
  this.lastUpdate=now;this.lastX=x;this.lastZ=z;this.lastRadius=radius;
  // Mode toiture uniquement lorsque la ville devient un semis de pixels :
  // 2 triangles par bâtiment au lieu des 12 d'un cube.
  // Hystérésis et bascule hors des gestes : aucune variation à 360°.
  if(now-this.lastZoomMotion>850){
    if(!this.roofOnly&&radius>6500)this.setRoofMode(true);
    else if(this.roofOnly&&radius<4700)this.setRoofMode(false);
  }
  const cellSize=m.tileMeters*m.cellsPerGroup;
  const range=Math.max(3000,Math.min(45000,radius*2.2));
  const near=m.groups.filter(g=>
   Math.hypot((g.gx+.5)*cellSize-x,(g.gz+.5)*cellSize-z)<range+2300
  ).sort((a,b)=>{
   const da=Math.hypot((a.gx+.5)*cellSize-x,(a.gz+.5)*cellSize-z);
   const db=Math.hypot((b.gx+.5)*cellSize-x,(b.gz+.5)*cellSize-z);
   return da-db;
  });
  for(const group of near){
   if(this.inFlight.size>=2)break;
   if(this.loaded.has(group.id)||this.inFlight.has(group.id)||
      now-(this.failures.get(group.id)??-Infinity)<retryAfterMs)continue;
   void this.load(group);
  }
 }

 /** Au zoom lointain, l'empreinte réelle orientée est visible,
  * mais les façades hors résolution ne consomment plus de triangles.
  * La hauteur reste l'altitude mesurée + hauteur bâtiment IGN.
  */
 private writeRoofTile(
  matrix:Float32Array,data:DataView,tile:TileRef,hide:boolean
 ):void{
  const step=this.manifest?.quantizationMeters??.25;
  const unit=this.manifest?.tileMeters??800;
  for(let j=0;j<tile.count;j++){
    const i=tile.offset+j,at=i*12,k=i*16;
    const x=tile.ix*unit+data.getInt16(at,true)*step;
    const z=tile.iz*unit+data.getInt16(at+2,true)*step;
    const w=Math.max(step,data.getUint16(at+4,true)*step);
    const d=Math.max(step,data.getUint16(at+6,true)*step);
    const h=Math.max(2,data.getUint16(at+8,true)*step);
    const a=data.getInt16(at+10,true)*Math.PI/32768;
    const c=Math.cos(a),s=Math.sin(a);
    matrix[k]=hide?0:w*c;
    matrix[k+2]=hide?0:w*s;
    matrix[k+5]=hide?0:1;
    matrix[k+8]=hide?0:-d*s;
    matrix[k+10]=hide?0:d*c;
    matrix[k+12]=x;
    matrix[k+13]=h+terrainHeight(x,z)+.045;
    matrix[k+14]=z;
    matrix[k+15]=1;
  }
 }
 private setRoofMode(enabled:boolean):void{
   if(enabled===this.roofOnly)return;
   this.roofOnly=enabled;
   for(const item of this.loaded.values()){
     item.mesh.setEnabled(!enabled);
     item.roof.setEnabled(enabled);
   }
 }

 private writeTile(matrix:Float32Array,data:DataView,tile:TileRef,hide:boolean):void{
  const step=this.manifest?.quantizationMeters??.25;
  const unit=this.manifest?.tileMeters??800;
  for(let j=0;j<tile.count;j++){
   const i=tile.offset+j,at=i*12,k=i*16;
   const x=tile.ix*unit+data.getInt16(at,true)*step;
   const z=tile.iz*unit+data.getInt16(at+2,true)*step;
   const w=Math.max(step,data.getUint16(at+4,true)*step);
   const d=Math.max(step,data.getUint16(at+6,true)*step);
   const h=Math.max(2,data.getUint16(at+8,true)*step);
   const angle=data.getInt16(at+10,true)*Math.PI/32768;
   const c=Math.cos(angle),s=Math.sin(angle);
   // Boîtes orientées selon les arêtes IGN, pas les axes de la carte.
   // Matrice colonne-major, sans rotation GPU supplémentaire.
   matrix[k]=hide?0:w*c;
   matrix[k+2]=hide?0:w*s;
   matrix[k+5]=hide?0:h;
   matrix[k+8]=hide?0:-d*s;
   matrix[k+10]=hide?0:d*c;
   matrix[k+12]=x;
   matrix[k+13]=h/2+terrainHeight(x,z);
   matrix[k+14]=z;
   matrix[k+15]=1;
  }
 }

 private async load(group:Group):Promise<void>{
  this.inFlight.add(group.id);
  try{
   const version=this.manifest?.sourceHash??String(this.manifest?.totalBuildings);
   const response=await fetch(PREFIX+group.id+'.bin?v='+version);
   if(!response.ok)throw Error('Groupe absent : '+group.id);
   const bytes=await response.arrayBuffer();
   if(bytes.byteLength!==group.bytes)throw Error('Groupe incomplet : '+group.id);
   const source=new DataView(bytes);
   const matrices=new Float32Array(group.count*16);
   const roofs=new Float32Array(group.count*16);
   // D'abord toutes les silhouettes, pour construire des bornes de
   // culling qui restent valables même lorsqu'une tuile est masquée.
   for(const tile of group.tiles){
    this.writeTile(matrices,source,tile,false);
    this.writeRoofTile(roofs,source,tile,false);
   }
   // Même palette que les géométries IGN de proximité pour atténuer
   // les transitions : murs pierre claire et couvertures gris zinc.
   const c=(r:number,g:number,b:number)=>new Color4(r,g,b,1);
   const wall=c(.91,.875,.80),roof=c(.60,.64,.68);
   const mesh=MeshBuilder.CreateBox('enveloppes-metropole-'+group.id,
    {size:1,faceColors:[wall,wall,wall,wall,roof,c(.83,.81,.76)]},
    this.scene);
   mesh.material=this.overviewMaterial;
   mesh.isPickable=false;
   // Matrices dynamiques : les substitutions IGN/LOD doivent mettre à jour
   // le GPU. Un buffer statique provoque des superpositions scintillantes.
   mesh.thinInstanceSetBuffer('matrix',matrices,16,false);
   mesh.thinInstanceRefreshBoundingInfo();
   const roof=MeshBuilder.CreateGround('toits-IGN-LOD-'+group.id,
     {width:1,height:1},this.scene);
   roof.material=this.roofMaterial;
   roof.isPickable=false;
   roof.thinInstanceSetBuffer('matrix',roofs,16,false);
   roof.thinInstanceRefreshBoundingInfo();
   let hidden=0;
   for(const tile of group.tiles){
    if(!this.detailed.has(tile.id))continue;
    this.writeTile(matrices,source,tile,true);
    this.writeRoofTile(roofs,source,tile,true);
    hidden+=tile.count;
   }
   if(hidden){
     mesh.thinInstanceBufferUpdated('matrix');
     roof.thinInstanceBufferUpdated('matrix');
   }
   mesh.freezeWorldMatrix();
   roof.freezeWorldMatrix();
   mesh.setEnabled(!this.roofOnly);
   roof.setEnabled(this.roofOnly);
   this.loaded.set(group.id,{mesh,roof,buffer:matrices,
     roofBuffer:roofs,bytes:source,group});
   this.currentCount+=group.tiles.reduce((sum,t)=>
    sum+(this.detailed.has(t.id)?0:t.count),0);
   this.failures.delete(group.id);
  }catch(error){
   console.warn('Groupe de silhouettes IGN',group.id,error);
   this.failures.set(group.id,performance.now());
  }finally{
   this.inFlight.delete(group.id);
   this.lastUpdate=0;
   this.lastX=Infinity;
   this.report();
  }
 }

 private report():void{
  const total=this.manifest?.totalBuildings??0;
  const represented=[...this.loaded.values()].reduce((sum,g)=>sum+g.group.count,0);
  this.onStatus(
   represented.toLocaleString('fr-FR')+'/'+total.toLocaleString('fr-FR')+
   ' bâtiments couverts par les volumes LOD simplifiés'+
   (this.failures.size?' · '+this.failures.size+' groupes à réessayer':''),
   this.currentCount);
 }
}
