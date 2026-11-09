import {Mesh,Scene,VertexData} from '@babylonjs/core';
import type {BuildingMaterials} from './buildings';
import {priorityHeritageRole} from './heritagePriorities';
import {ArchitectureDossiers} from './architectureDossiers';
import {HeritageSwap,heritageFootprints,modelShapeFromParts} from './heritageFootprints';
import type {ModelShape} from './heritageFootprints';

/** Bascule unique partagée avec la construction des tuiles (R02-D1/D2/D7).
 * Les extrusions des emprises listées dans `heritage-footprints.json` sont
 * des maillages séparés ; remplacer = `isVisible=false`, jamais
 * `setIndices()`. Le maillage reste activé et sélectionnable. */
let rejectModel:(ref:string)=>void=()=>{};
export const extrusionSwap=new HeritageSwap<Mesh>(heritageFootprints,
  ref=>rejectModel(ref));
interface ModelLod{tier:'high'|'medium'|'low';maxRadiusMeters:number;file:string;}
interface ModelDescriptor{ref:string;x:number;z:number;sourceIds:string[];
 lods:ModelLod[];fullReplacement:boolean;review:'measured-and-approved';}
interface ModelIndex{schema:1;models:ModelDescriptor[];}
interface ModelPart{name:string;kind:'wall'|'roof'|'detail';
 positions:number[];indices:number[];sourceIds:string[];}
interface ModelFile{schema:1;ref:string;units:'m';
 coordinates:'paris-local-xyz';tier:ModelLod['tier'];
 sourceIds:string[];parts:ModelPart[];}
interface Rendered{tier:ModelLod['tier'];meshes:Mesh[];shape:ModelShape;}
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
 /** Fichiers rejetés (emprise non couverte) : ne pas les recharger. */
 private rejected=new Set<string>();
 /** Emprise IGN pas encore chargée : réessayer plus tard, pas à 450 ms. */
 private retryAfter=new Map<string,number>();
 constructor(private scene:Scene,private docs:ArchitectureDossiers,
  private materials:BuildingMaterials){
  rejectModel=ref=>this.reject(ref);
 }
 /** Une tuile chargée après la maquette révèle une emprise non couverte :
  * l'extrusion est déjà restituée par la bascule, retirer la maquette. */
 private reject(ref:string):void{
  const rendered=this.loaded.get(ref);
  if(!rendered)return;
  console.warn('Maquette retirée : emprise IGN non couverte',ref);
  this.rejected.add(ref+'@'+rendered.tier);
  rendered.meshes.forEach(m=>m.dispose());
  this.loaded.delete(ref);
 }
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
   // Triangle mal formé (sommet répété) : fichier incohérent, rejeté.
   for(let k=0;k<part.indices.length;k+=3){
    const a=part.indices[k],b=part.indices[k+1],c=part.indices[k+2];
    if(a===b||b===c||a===c)return false;
   }
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
   // D7, étape 2 : valider l'emprise AVANT de créer le moindre maillage.
   // Projection horizontale réelle des triangles (pas seulement la boîte).
   const shape=modelShapeFromParts(obj.parts);
   if(!shape)throw Error('Sommets non finis');
   if(!extrusionSwap.allLoaded(model.ref)){
    // Rien à comparer ni à masquer tant que toutes les extrusions de la
    // référence ne sont pas chargées : réessayer, ne pas rejeter.
    this.retryAfter.set(model.ref,performance.now()+5000);
    return;
   }
   if(extrusionSwap.conflicts(model.ref)){
    // Une autre maquette (ensemble ou partie) occupe déjà l'emprise :
    // pas de double silhouette ; réessayer quand elle sera retirée.
    this.retryAfter.set(model.ref,performance.now()+2000);
    return;
   }
   if(!extrusionSwap.accepts(model.ref,shape)){
    this.rejected.add(model.ref+'@'+lod.tier);
    throw Error('Maquette hors de l\'emprise IGN attendue');
   }
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
   // D7, étape 3 : la maquette est affichée (créée activée) ; étape 4 :
   // seulement alors masquer l'extrusion. En cas d'échec, l'extrusion
   // reste visible et la maquette est détruite par le bloc finally.
   const previous=this.loaded.get(model.ref);
   if(!extrusionSwap.activate(model.ref,shape))
    throw Error('Emprise IGN refusée au moment de la bascule');
   this.loaded.set(model.ref,{tier:lod.tier,meshes,shape});
   this.retryAfter.delete(model.ref);
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
      this.loading.has(model.ref)||
      this.rejected.has(model.ref+'@'+lod.tier)||
      (this.retryAfter.get(model.ref)??0)>now)continue;
   void this.load(model,lod);
  }
  for(const [ref,previous] of this.loaded){
   if(this.wanted.has(ref))continue;
   // Restituer les volumes IGN AVANT de retirer le maillage expert.
   extrusionSwap.deactivate(ref);
   previous.meshes.forEach(m=>m.dispose());
   this.loaded.delete(ref);
  }
 }
}
