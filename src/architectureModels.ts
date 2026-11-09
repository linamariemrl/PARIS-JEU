import {Mesh,Scene,VertexData} from '@babylonjs/core';
import type {Building} from './types';
import type {BuildingMaterials} from './buildings';
import {priorityHeritageRole} from './heritagePriorities';
import {ArchitectureDossiers} from './architectureDossiers';

interface BatchMetadata{buildings:Building[];faceToBuilding:number[];}
interface Snapshot{indices:number[];faces:number[];}
const originalBatches=new WeakMap<Mesh,Snapshot>();
const activeRefs=new Set<string>();
/** La ville est déjà fusionnée en grands maillages par tuile.
 * Ne masquer que les triangles des bâtiments REMPLACÉS par un modèle
 * mesuré effectivement chargé. Les voisins, sélection et trous demeurent.
 * Ne jamais supprimer un bâtiment si son maillage expert est absent.
 */
export function applyArchitecturalMask(mesh:Mesh):void{
 const meta=mesh.metadata as BatchMetadata|undefined;
 if(!meta||!Array.isArray(meta.buildings)||
   !Array.isArray(meta.faceToBuilding))return;
 let original=originalBatches.get(mesh);
 if(!original){
   if(!activeRefs.size||!meta.faceToBuilding.some(id=>
     activeRefs.has(meta.buildings[id]?.heritageRef??'')))return;
   const indices=mesh.getIndices();
   if(!indices||indices.length!==meta.faceToBuilding.length*3)return;
   original={indices:Array.from(indices),faces:meta.faceToBuilding.slice()};
   originalBatches.set(mesh,original);
 }
 const keep:number[]=[],faces:number[]=[];
 for(let i=0;i<original.faces.length;i++){
  const building=meta.buildings[original.faces[i]];
  if(activeRefs.has(building?.heritageRef??''))continue;
  keep.push(original.indices[3*i],original.indices[3*i+1],
    original.indices[3*i+2]);
  faces.push(original.faces[i]);
 }
 if(keep.length===original.indices.length&&
    mesh.getIndices()?.length===keep.length)return;
 mesh.setIndices(keep);
 meta.faceToBuilding=faces;
}
function maskAll(scene:Scene):void{
 for(const mesh of scene.meshes)if(mesh instanceof Mesh)applyArchitecturalMask(mesh);
}
interface ModelLod{tier:'high'|'medium'|'low';maxRadiusMeters:number;file:string;}
interface ModelDescriptor{ref:string;x:number;z:number;sourceIds:string[];
 lods:ModelLod[];fullReplacement:boolean;review:'measured-and-approved';}
interface ModelIndex{schema:1;models:ModelDescriptor[];}
interface ModelPart{name:string;kind:'wall'|'roof'|'detail';
 positions:number[];indices:number[];sourceIds:string[];}
interface ModelFile{schema:1;ref:string;units:'m';
 coordinates:'paris-local-xyz';tier:ModelLod['tier'];
 sourceIds:string[];parts:ModelPart[];}
interface Rendered{tier:ModelLod['tier'];meshes:Mesh[];}
const prefix='data/metropole/architecture/models/';
/** Modèles mesurés, non schématiques. L'index est vide tant qu'aucun
 * relevé coté + contrôle géométrique n'a été effectivement réalisé.
 * Aucun cube, toit ou colonne n'est inventé en cas de fichier absent.
 */
export class ArchitecturalModelLibrary{
 private models:ModelDescriptor[]=[];
 private loaded=new Map<string,Rendered>();
 private loading=new Set<string>();
 private wanted=new Map<string,ModelLod['tier']>();
 private last=0;
 constructor(private scene:Scene,private docs:ArchitectureDossiers,
  private materials:BuildingMaterials){}
 async init():Promise<void>{
  try{
   const response=await fetch(import.meta.env.BASE_URL+prefix+'index.json');
   if(!response.ok)throw Error('Index des modèles absent');
   const doc=await response.json() as ModelIndex;
   if(doc.schema!==1||!Array.isArray(doc.models))throw Error('Index invalide');
   // Un modèle ne devient actif qu'après validation explicite des
   // mesures citées dans son dossier, jamais à cause de son nom.
   this.models=doc.models.filter(m=>
      /^PA\d{8}$/.test(m.ref)&&Number.isFinite(m.x)&&Number.isFinite(m.z)&&
      m.fullReplacement===true&&m.review==='measured-and-approved'&&
      this.docs.canPublish(m.ref,m.sourceIds)&&
      Array.isArray(m.lods)&&m.lods.length>0);
  }catch(error){console.warn('Maquettes métriques non publiées',error);}
 }
 private material(ref:string,kind:ModelPart['kind']){
  const roof=kind==='roof';
  switch(priorityHeritageRole(ref)){
   case 'political':return roof?this.materials.politicalRoof:this.materials.politicalWall;
   case 'cultural':return roof?this.materials.culturalRoof:this.materials.culturalWall;
   case 'financial':return roof?this.materials.financialRoof:this.materials.financialWall;
   default:return roof?this.materials.heritageRoof:this.materials.heritageWall;
  }
 }
 private valid(ref:string,lod:ModelLod,sourceIds:string[],
   obj:ModelFile):boolean{
  if(obj.schema!==1||obj.ref!==ref||obj.units!=='m'||
     obj.coordinates!=='paris-local-xyz'||obj.tier!==lod.tier||
     !Array.isArray(obj.parts)||!obj.parts.length||
     obj.parts.length>400||!Array.isArray(obj.sourceIds)||
     !obj.sourceIds.length||
     !obj.sourceIds.every(id=>sourceIds.includes(id))||
     !this.docs.canPublish(ref,obj.sourceIds))return false;
  let vertices=0,triangles=0;
  for(const part of obj.parts){
   if(!['wall','roof','detail'].includes(part.kind)||
      !Array.isArray(part.sourceIds)||!part.sourceIds.length||
      !part.sourceIds.every(id=>obj.sourceIds.includes(id))||
      !Array.isArray(part.positions)||!Array.isArray(part.indices)||
      part.positions.length<9||part.positions.length%3!==0||
      part.indices.length<3||part.indices.length%3!==0||
      !part.positions.every(p=>Number.isFinite(p)&&Math.abs(p)<85000)||
      !part.indices.every(i=>Number.isInteger(i)&&i>=0&&
        i<part.positions.length/3))return false;
   vertices+=part.positions.length/3;
   triangles+=part.indices.length/3;
  }
  return vertices<=180000&&triangles<=300000&&triangles>=40;
 }
 private async load(model:ModelDescriptor,lod:ModelLod):Promise<void>{
  if(this.loading.has(model.ref))return;
  this.loading.add(model.ref);
  let meshes:Mesh[]=[];
  try{
   if(!/^PA\d{8}-(?:high|medium|low)[.]json$/.test(lod.file))
    throw Error('Nom de modèle non autorisé');
   const response=await fetch(import.meta.env.BASE_URL+prefix+lod.file);
   if(!response.ok)throw Error('Maillage coté manquant');
   const obj=await response.json() as ModelFile;
   if(!this.valid(model.ref,lod,model.sourceIds,obj))
    throw Error('Maillage sans provenance ou hors limites techniques');
   if(this.wanted.get(model.ref)!==lod.tier)return;
   for(const part of obj.parts){
    const mesh=new Mesh('monument-mesure-'+model.ref+'-'+part.name,this.scene);
    const vd=new VertexData();
    vd.positions=part.positions;
    vd.indices=part.indices;
    const normals:number[]=[];
    VertexData.ComputeNormals(part.positions,part.indices,normals);
    vd.normals=normals;
    vd.applyToMesh(mesh);
    mesh.material=this.material(model.ref,part.kind);
    mesh.isPickable=false;
    mesh.freezeWorldMatrix();
    meshes.push(mesh);
   }
   if(this.wanted.get(model.ref)!==lod.tier)return;
   const previous=this.loaded.get(model.ref);
   this.loaded.set(model.ref,{tier:lod.tier,meshes});
   activeRefs.add(model.ref);
   maskAll(this.scene);
   previous?.meshes.forEach(m=>m.dispose());
   meshes=[];
  }catch(error){console.warn('Maquette architecturale non validée',model.ref,error);}
  finally{
   meshes.forEach(m=>m.dispose());
   this.loading.delete(model.ref);
  }
 }
 update(x:number,z:number,radius:number,isMoving:boolean):void{
  if(isMoving)return;
  const now=performance.now();
  if(now-this.last<450)return;
  this.last=now;
  const candidates=this.models.filter(m=>
    Math.hypot(m.x-x,m.z-z)<Math.min(2500,Math.max(450,radius*1.5)))
   .sort((a,b)=>Math.hypot(a.x-x,a.z-z)-Math.hypot(b.x-x,b.z-z))
   .slice(0,3);
  this.wanted.clear();
  for(const model of candidates){
   const tier=radius<650?'high':radius<1500?'medium':'low';
   const lod=model.lods.find(l=>l.tier===tier)??model.lods.find(l=>l.tier==='low');
   if(!lod||radius>lod.maxRadiusMeters)continue;
   this.wanted.set(model.ref,lod.tier);
   if(this.loaded.get(model.ref)?.tier===lod.tier||
      this.loading.has(model.ref))continue;
   void this.load(model,lod);
  }
  for(const [ref,previous] of this.loaded){
   if(this.wanted.has(ref))continue;
   // Restituer les volumes IGN AVANT de retirer le maillage expert.
   activeRefs.delete(ref);maskAll(this.scene);
   previous.meshes.forEach(m=>m.dispose());
   this.loaded.delete(ref);
  }
 }
}
