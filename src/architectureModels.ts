import {Mesh,Scene,VertexData} from '@babylonjs/core';
import type {StandardMaterial} from '@babylonjs/core';
import type {BuildingMaterials} from './buildings';
import {priorityHeritageRole} from './heritagePriorities';
import {ArchitectureDossiers} from './architectureDossiers';
import {HeritageSwap,heritageFootprints,modelShapeFromParts,footprintShape}
 from './heritageFootprints';
import type {ModelShape,FootprintShape} from './heritageFootprints';
import {chooseTier} from './lodHysteresis';
import {masterToScene} from './registration';
import type {SceneFrame} from './registration';
import {CENTER} from './geo';
import {displayReferenceAltitude} from './terrain';

/** Bascule unique partagée avec la construction des tuiles (R02-D1/D2/D7).
 * Les extrusions des emprises listées dans `heritage-footprints.json` sont
 * des maillages séparés ; remplacer = `isVisible=false`, jamais
 * `setIndices()`. Le maillage reste activé et sélectionnable. */
let rejectModel:(ref:string)=>void=()=>{};
export const extrusionSwap=new HeritageSwap<Mesh>(heritageFootprints,
  ref=>rejectModel(ref));
interface ModelLod{tier:'high'|'medium'|'low';maxRadiusMeters:number;file:string;}
/** Entrée de `models/index.json`.
 * - Maquette complète (comportement historique, inchangé) :
 *   `fullReplacement:true`, verrou `publicationAllowed` du dossier.
 * - Partie certifiée (R02-D4, additif) : `replacement:'partial'`, `partId`,
 *   `partFootprint` (polygone 2D en coordonnées de scène), autorisée par
 *   `certifiedParts` du dossier. Une partie ne masque jamais l'extrusion. */
interface ModelDescriptor{ref:string;x:number;z:number;sourceIds:string[];
 lods:ModelLod[];fullReplacement?:boolean;review:'measured-and-approved';
 replacement?:'full'|'partial';partId?:string;partFootprint?:[number,number][];}
interface ModelIndex{schema:1;models:ModelDescriptor[];}
interface ModelPart{name:string;kind:'wall'|'roof'|'detail';
 positions:number[];indices:number[];sourceIds:string[];}
/** Deux repères admis :
 * - 'paris-local-xyz' : sommets déjà en coordonnées de scène (historique) ;
 * - 'epsg2154-relative' (R02-D5) : sommets [dE, dN, dAltitude NGF] relatifs à
 *   `originL93` [E, N, altitude NGF], convertis explicitement au chargement. */
interface ModelFile{schema:1;ref:string;units:'m';
 coordinates:'paris-local-xyz'|'epsg2154-relative';
 originL93?:[number,number,number];tier:ModelLod['tier'];partId?:string;
 sourceIds:string[];parts:ModelPart[];}
const sceneFrame=():SceneFrame|null=>{
 const ref=displayReferenceAltitude();
 return ref===null?null:{center:[CENTER[0],CENTER[1]],displayReferenceAltitudeM:ref};
};
interface Rendered{tier:ModelLod['tier'];meshes:Mesh[];shape:ModelShape|null;
 partial:boolean;ref:string;}
const prefix='data/metropole/architecture/models/';
const PART_ID=/^[a-z0-9][a-z0-9-]{0,47}$/;
const isPartial=(m:ModelDescriptor)=>m.replacement==='partial';
/** Clé d'une maquette : la référence pour une maquette complète, la
 * référence et la partie pour une partie certifiée. */
const keyOf=(m:ModelDescriptor)=>isPartial(m)?m.ref+'#'+m.partId:m.ref;

/** Modèles mesurés, non schématiques. L'index est vide tant qu'aucun
 * relevé coté + contrôle géométrique n'a été effectivement réalisé.
 * Aucun cube, toit ou colonne n'est inventé en cas de fichier absent.
 */
export class ArchitecturalModelLibrary{
 private models:ModelDescriptor[]=[];
 private parts=new Map<string,FootprintShape>();
 private loaded=new Map<string,Rendered>();
 private loading=new Set<string>();
 private wanted=new Map<string,ModelLod['tier']>();
 private last=0;
 /** Fichiers rejetés (emprise non couverte) : ne pas les recharger. */
 private rejected=new Set<string>();
 /** Emprise IGN pas encore chargée : réessayer plus tard, pas à 450 ms. */
 private retryAfter=new Map<string,number>();
 private overlay=new Map<StandardMaterial,StandardMaterial>();
 constructor(private scene:Scene,private docs:ArchitectureDossiers,
  private materials:BuildingMaterials,
  private frame:()=>SceneFrame|null=sceneFrame){
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
   const common=(m:ModelDescriptor)=>
      /^PA\d{8}$/.test(m.ref)&&Number.isFinite(m.x)&&Number.isFinite(m.z)&&
      m.review==='measured-and-approved'&&Array.isArray(m.sourceIds)&&
      Array.isArray(m.lods)&&m.lods.length>0;
   const full=(m:ModelDescriptor)=>!isPartial(m)&&
      m.fullReplacement===true&&this.docs.canPublish(m.ref,m.sourceIds);
   const partial=(m:ModelDescriptor)=>isPartial(m)&&
      typeof m.partId==='string'&&PART_ID.test(m.partId)&&
      this.docs.canPublishPart(m.ref,m.partId,m.sourceIds)&&
      this.partShape(m)!==null;
   this.models=doc.models.filter(m=>common(m)&&(full(m)||partial(m)));
  }catch(error){console.warn('Maquettes métriques non publiées',error);}
 }
 private partShape(m:ModelDescriptor):FootprintShape|null{
  const key=keyOf(m);
  if(this.parts.has(key))return this.parts.get(key)!;
  const pts=m.partFootprint;
  if(!Array.isArray(pts)||pts.length<3||pts.length>2000||
     !pts.every(p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)))return null;
  const shape=footprintShape([[pts.map(([x,z])=>({x,z}))]]);
  if(shape)this.parts.set(key,shape);
  return shape;
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
 /** Partie superposée à l'extrusion : même teinte, léger décalage de
  * profondeur seulement (aucune géométrie déplacée), pour éviter le
  * scintillement des faces coplanaires. */
 private overlayMaterial(base:StandardMaterial):StandardMaterial{
  let m=this.overlay.get(base);
  if(!m){
   m=base.clone(base.name+'-partie-certifiee');
   m.zOffset=-2;m.freeze();
   this.overlay.set(base,m);
  }
  return m;
 }
 private valid(model:ModelDescriptor,lod:ModelLod,obj:ModelFile):boolean{
  const ref=model.ref,sourceIds=model.sourceIds;
  const allowed=isPartial(model)?
   obj.partId===model.partId&&this.docs.canPublishPart(ref,model.partId!,obj.sourceIds):
   obj.partId===undefined&&this.docs.canPublish(ref,obj.sourceIds);
  const l93=obj.coordinates==='epsg2154-relative';
  if(l93&&!(Array.isArray(obj.originL93)&&obj.originL93.length===3&&
     obj.originL93.every(Number.isFinite)&&obj.originL93[0]>0&&obj.originL93[0]<1.3e6&&
     obj.originL93[1]>6e6&&obj.originL93[1]<7.2e6))return false;
  if(obj.schema!==1||obj.ref!==ref||obj.units!=='m'||
     (obj.coordinates!=='paris-local-xyz'&&!l93)||obj.tier!==lod.tier||
     !Array.isArray(obj.parts)||!obj.parts.length||
     obj.parts.length>400||!Array.isArray(obj.sourceIds)||
     !obj.sourceIds.length||
     !obj.sourceIds.every(id=>sourceIds.includes(id))||!allowed)return false;
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
  // Une partie (une travée, une assise) peut être petite ; une maquette
  // complète doit avoir un minimum de substance.
  const minTriangles=isPartial(model)?2:40;
  return vertices<=180000&&triangles<=300000&&triangles>=minTriangles;
 }
 private fileAllowed(model:ModelDescriptor,lod:ModelLod):boolean{
  return isPartial(model)?
   lod.file===model.ref+'-'+model.partId+'-'+lod.tier+'.json':
   /^PA\d{8}-(?:high|medium|low)[.]json$/.test(lod.file);
 }
 /** Retirer toute partie superposée dont une emprise IGN est désormais
  * remplacée par une maquette complète, QUELLE QUE SOIT sa référence :
  * la règle de coexistence se déduit de l'index IGN (plusieurs-à-
  * plusieurs), pas de l'égalité des références. Jamais de double
  * silhouette ; la partie reviendra quand l'emprise sera restituée. */
 private dropPartials():void{
  for(const [key,r] of this.loaded){
   if(!r.partial||!extrusionSwap.replacedFor(r.ref))continue;
   r.meshes.forEach(m=>m.dispose());
   this.loaded.delete(key);
  }
 }
 private async load(model:ModelDescriptor,lod:ModelLod):Promise<void>{
  const key=keyOf(model);
  if(this.loading.has(key))return;
  this.loading.add(key);
  let meshes:Mesh[]=[];
  try{
   if(!this.fileAllowed(model,lod))throw Error('Nom de modèle non autorisé');
   const response=await fetch(import.meta.env.BASE_URL+prefix+lod.file);
   if(!response.ok)throw Error('Maillage coté manquant');
   const obj=await response.json() as ModelFile;
   if(!this.valid(model,lod,obj))
    throw Error('Maillage sans provenance ou hors limites techniques');
   if(this.wanted.get(key)!==lod.tier)return;
   if(obj.coordinates==='epsg2154-relative'){
    // D5 : conversion explicite EPSG:2154 + NGF -> scène, avant tout
    // contrôle d'emprise ; sans MNT, pas de référence verticale : différer.
    const f=this.frame();
    if(!f){this.retryAfter.set(key,performance.now()+5000);return;}
    for(const part of obj.parts)part.positions=masterToScene(part.positions,obj.originL93!,f);
   }
   // D7, étape 2 : valider l'emprise AVANT de créer le moindre maillage.
   // Projection horizontale réelle des triangles (pas seulement la boîte).
   const shape=isPartial(model)?null:modelShapeFromParts(obj.parts);
   if(!isPartial(model)&&!shape)throw Error('Sommets non finis');
   if(!extrusionSwap.allLoaded(model.ref)){
    // Rien à comparer ni à masquer tant que toutes les extrusions de la
    // référence ne sont pas chargées : réessayer, ne pas rejeter.
    this.retryAfter.set(key,performance.now()+5000);
    return;
   }
   if(isPartial(model)){
    // D4 : une partie n'est jamais posée sur une maquette complète active.
    if(extrusionSwap.replacedFor(model.ref)){
     this.retryAfter.set(key,performance.now()+2000);
     return;
    }
    const fit=extrusionSwap.acceptsPart(model.ref,this.partShape(model)!,
      obj.parts.map(p=>p.positions));
    if(!fit?.ok){
     this.rejected.add(key+'@'+lod.tier);
     throw Error('Partie hors de son emprise déclarée ou de l\'emprise IGN');
    }
   }else{
    if(extrusionSwap.conflicts(model.ref)){
     // Une autre maquette (ensemble ou partie) occupe déjà l'emprise :
     // pas de double silhouette ; réessayer quand elle sera retirée.
     this.retryAfter.set(key,performance.now()+2000);
     return;
    }
    if(!extrusionSwap.accepts(model.ref,shape!)){
     this.rejected.add(key+'@'+lod.tier);
     throw Error('Maquette hors de l\'emprise IGN attendue');
    }
   }
   for(const part of obj.parts){
    const mesh=new Mesh('monument-mesure-'+model.ref+
      (isPartial(model)?'-'+model.partId:'')+'-'+part.name,this.scene);
    const vd=new VertexData();
    vd.positions=part.positions;
    vd.indices=part.indices;
    const normals:number[]=[];
    VertexData.ComputeNormals(part.positions,part.indices,normals);
    vd.normals=normals;
    vd.applyToMesh(mesh);
    const base=this.material(model.ref,part.kind);
    mesh.material=isPartial(model)?this.overlayMaterial(base):base;
    mesh.isPickable=false;
    mesh.freezeWorldMatrix();
    meshes.push(mesh);
   }
   if(this.wanted.get(key)!==lod.tier)return;
   // D7, étape 3 : la maquette est affichée (créée activée) ; étape 4 :
   // seulement alors masquer l'extrusion (maquette complète uniquement).
   // En cas d'échec, l'extrusion reste visible et la maquette est
   // détruite par le bloc finally.
   const previous=this.loaded.get(key);
   if(!isPartial(model)){
    if(!extrusionSwap.activate(model.ref,shape!))
     throw Error('Emprise IGN refusée au moment de la bascule');
    this.dropPartials();
   }
   this.loaded.set(key,{tier:lod.tier,meshes,shape,partial:isPartial(model),ref:model.ref});
   this.retryAfter.delete(key);
   previous?.meshes.forEach(m=>m.dispose());
   meshes=[];
  }catch(error){console.warn('Maquette architecturale non validée',key,error);}
  finally{
   meshes.forEach(m=>m.dispose());
   this.loading.delete(key);
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
   .slice(0,6);
  const previousWanted=new Map(this.wanted);
  this.wanted.clear();
  for(const model of candidates){
   const key=keyOf(model);
   // D6 : hystérésis sur le niveau affiché (ou demandé) pour cette clé.
   const tier=chooseTier(radius,this.loaded.get(key)?.tier??previousWanted.get(key));
   const lod=model.lods.find(l=>l.tier===tier)??model.lods.find(l=>l.tier==='low');
   if(!lod||radius>lod.maxRadiusMeters)continue;
   this.wanted.set(key,lod.tier);
   if(this.loaded.get(key)?.tier===lod.tier||
      this.loading.has(key)||
      this.rejected.has(key+'@'+lod.tier)||
      (this.retryAfter.get(key)??0)>now)continue;
   void this.load(model,lod);
  }
  // Filet de sécurité à chaque cycle, quel que soit l'ordre d'arrivée.
  this.dropPartials();
  for(const [ref,previous] of this.loaded){
   if(this.wanted.has(ref))continue;
   // Restituer les volumes IGN AVANT de retirer le maillage expert.
   if(!previous.partial)extrusionSwap.deactivate(ref);
   previous.meshes.forEach(m=>m.dispose());
   this.loaded.delete(ref);
  }
 }
 /** Diagnostic de test : clés affichées et leur niveau. */
 displayed():[string,ModelLod['tier']][]{
  return [...this.loaded].map(([k,r])=>[k,r.tier]);
 }
}
