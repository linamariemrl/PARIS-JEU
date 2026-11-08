import {Color3,Mesh,MeshBuilder,Scene,StandardMaterial} from '@babylonjs/core';
import {terrainHeight} from './terrain';

/** Atlas complet des bâtiments IGN en cellules agrégées de 50 m.
 * Les vrais volumes et plans de toiture sont toujours fournis par les
 * gestionnaires de tuiles exactes. Aucune cellule n'est inventée hors
 * d'un groupe comportant au moins un bâtiment IGN recensé.
 */
interface CellGroup {id:string;cells:number;buildings:number;bytes:number}
interface AtlasManifest {
 schema:1;cellMeters:50;totalBuildings:number;sourceHash:string;
 representation:'aggregated-50m-cells';groups:CellGroup[];
}
const ROOT=import.meta.env.BASE_URL+'data/metropole/coverage/';
export class CityCoverage {
 private meshes=new Map<string,Mesh>();
 private hidden=new Set<string>();
 private count=0;
 private complete=false;
 private applied=false;
 private initialized=false;
 private retryTimer:number|null=null;
 private retryCount=0;
 private material:StandardMaterial;
 constructor(private scene:Scene,private onStatus:(message:string)=>void){
  this.material=new StandardMaterial('atlas-presence-batie-IGN',scene);
  this.material.diffuseColor=new Color3(.86,.86,.85);
  this.material.emissiveColor=new Color3(.86,.86,.85);
  this.material.specularColor=Color3.Black();
  this.material.disableLighting=true;
  this.material.backFaceCulling=false;
  this.material.freeze();
  // Relance de l'atlas IGN lors du retour réseau, sans redémarrage du jeu.
  window.addEventListener('online',()=>{
   if(this.complete||this.initialized)return;
   this.retryCount=0;
   if(this.retryTimer!==null)window.clearTimeout(this.retryTimer);
   this.retryTimer=null;
   void this.init();
  });
 }
 get ready(){return this.complete;}
 get buildings(){return this.complete?this.count:0;}
 get groupCount(){return this.meshes.size;}
 showExcept(groupIds:readonly string[]):void{
  const next=new Set(groupIds);
  if(this.complete&&this.applied&&next.size===this.hidden.size&&
     [...next].every(id=>this.hidden.has(id)))return;
  this.hidden=next;
  if(!this.complete)return;
  for(const [id,mesh] of this.meshes)
   mesh.setEnabled(!this.hidden.has(id));
  this.applied=true;
 }
 async init():Promise<void>{
  if(this.initialized||this.complete)return;
  this.initialized=true;
  if(this.retryTimer!==null){
   window.clearTimeout(this.retryTimer);
   this.retryTimer=null;
  }
  try{
   const response=await fetch(ROOT+'manifest.json');
   if(!response.ok)throw Error('Atlas bâti non publié');
   const manifest=await response.json() as AtlasManifest;
   if(manifest.schema!==1||manifest.cellMeters!==50||
      manifest.representation!=='aggregated-50m-cells'||
      !Array.isArray(manifest.groups)||manifest.groups.length<10||
      manifest.totalBuildings<15000||
      manifest.groups.reduce((n,g)=>n+g.buildings,0)!==manifest.totalBuildings)
    throw Error('Atlas IGN incomplet');
   this.count=manifest.totalBuildings;
   const toLoad=[...manifest.groups];
   const workers=3;
   let offset=0;
   let failed:unknown=null;
   const loadWorker=async()=>{
    while(offset<toLoad.length&&!failed){
     const group=toLoad[offset++];
     try{
      await this.loadGroup(group,manifest.sourceHash);
     }catch(error){failed=error;return;}
    }
   };
   await Promise.all(Array.from({length:workers},()=>loadWorker()));
   if(failed||this.meshes.size!==manifest.groups.length)
    throw Error('Atlas incomplet : '+String(failed));
   this.complete=true;
   this.retryCount=0;
   this.showExcept([...this.hidden]);
   this.onStatus(this.count.toLocaleString('fr-FR')+
     ' bâtiments IGN couverts sur tous les secteurs (atlas 50 m ; volumes près)');
  }catch(error){
   // Repli sur les niveaux de détail historiques ; pas d'atlas partiel.
   for(const mesh of this.meshes.values())mesh.dispose();
   this.meshes.clear();
   this.complete=false;
   this.applied=false;
   this.initialized=false;
   this.onStatus('Atlas temporairement indisponible : reprise réseau prévue');
   console.warn('Atlas bâtis complet indisponible',error);
   // Reprise bornée à trois essais afin de préserver la batterie mobile.
   if(this.retryCount<3){
    this.retryCount++;
    this.retryTimer=window.setTimeout(()=>{
     this.retryTimer=null;
     if(navigator.onLine)void this.init();
    },8000*this.retryCount);
   }
  }
 }
 private async loadGroup(group:CellGroup,version:string):Promise<void>{
  const response=await fetch(ROOT+group.id+'.bin?v='+version);
  if(!response.ok)throw Error('Groupe de couverture absent '+group.id);
  const bytes=await response.arrayBuffer();
  if(bytes.byteLength!==group.bytes||bytes.byteLength!==group.cells*8)
   throw Error('Nombre de cellules incorrect '+group.id);
  const view=new DataView(bytes);
  const matrices=new Float32Array(group.cells*16);
  let buildings=0;
  for(let i=0;i<group.cells;i++){
   const pos=i*8,k=i*16;
   const x=view.getInt16(pos,true),z=view.getInt16(pos+2,true);
   const side=view.getUint8(pos+4),height=view.getUint8(pos+5);
   buildings+=view.getUint16(pos+6,true);
   matrices[k]=side;
   matrices[k+5]=1;
   matrices[k+10]=side;
   matrices[k+12]=x;
   matrices[k+13]=terrainHeight(x,z)+height-.6;
   matrices[k+14]=z;
   matrices[k+15]=1;
  }
  if(buildings!==group.buildings)throw Error('Effectif incohérent '+group.id);
  const mesh=MeshBuilder.CreateGround('atlas-bati-'+group.id,
    {width:1,height:1},this.scene);
  mesh.material=this.material;
  mesh.isPickable=false;
  mesh.thinInstanceSetBuffer('matrix',matrices,16,true);
  mesh.thinInstanceRefreshBoundingInfo();
  mesh.freezeWorldMatrix();
  mesh.setEnabled(false);
  this.meshes.set(group.id,mesh);
  // Céder une frame après les buffers pour conserver la réponse tactile.
  await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
 }
}
