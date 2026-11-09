// Banc d'essai Babylon.js réel (NullEngine, sans GPU) pour la bascule
// extrusion IGN <-> maquette experte. Regroupé par esbuild depuis
// scripts/check_heritage_scene.mjs. Rien ici n'est publié.
//
// La « maquette » est un FAUX (`test-fixture`) : un pavé subdivisé calé sur
// la boîte de l'extrusion IGN, servi par un fetch simulé. Il ne sort jamais
// de ce banc et ne prétend représenter aucune géométrie réelle.
import {NullEngine,Scene,ArcRotateCamera,Vector3,Ray,Mesh} from '@babylonjs/core';
import {createMaterials,createTile,getPickedBuilding} from '../../src/buildings';
import {ArchitecturalModelLibrary,extrusionSwap} from '../../src/architectureModels';
import {FootprintIndex,parseFootprintTable,setHeritageFootprints,
 isBuildingPickProxy} from '../../src/heritageFootprints';
import type {Box2} from '../../src/heritageFootprints';
import type {TileFile} from '../../src/types';
import type {ArchitectureDossiers} from '../../src/architectureDossiers';

export interface Inputs{tile:TileFile;table:unknown;ref:string;ignId:string;
 pop:{x:number;z:number};}
type Check=(ok:unknown,label:string)=>void;

function clone(tile:TileFile):TileFile{return JSON.parse(JSON.stringify(tile));}
const tick=async(n=6)=>{for(let i=0;i<n;i++)await new Promise(r=>setTimeout(r,0));};

/** Pavé subdivisé : 2*n*n triangles par face, 5 faces. */
function fixtureBox(box:Box2,height:number,n:number,offsetX=0){
 const p:number[]=[],idx:number[]=[];
 const x0=box.minX+offsetX,x1=box.maxX+offsetX,z0=box.minZ,z1=box.maxZ;
 const face=(o:number[],u:number[],v:number[])=>{
  const s=p.length/3;
  for(let i=0;i<=n;i++)for(let j=0;j<=n;j++)
   p.push(o[0]+u[0]*i/n+v[0]*j/n,o[1]+u[1]*i/n+v[1]*j/n,o[2]+u[2]*i/n+v[2]*j/n);
  for(let i=0;i<n;i++)for(let j=0;j<n;j++){
   const a=s+i*(n+1)+j,b=a+n+1;
   idx.push(a,b,a+1,a+1,b,b+1);
  }
 };
 face([x0,0,z0],[x1-x0,0,0],[0,height,0]);
 face([x0,0,z1],[x1-x0,0,0],[0,height,0]);
 face([x0,0,z0],[0,0,z1-z0],[0,height,0]);
 face([x1,0,z0],[0,0,z1-z0],[0,height,0]);
 face([x0,height,z0],[x1-x0,0,0],[0,0,z1-z0]);
 return {positions:p,indices:idx};
}

function triangles(meshes:Mesh[]):number{
 return meshes.reduce((s,m)=>s+(m.getTotalIndices()/3),0);
}
function facesByBuilding(meshes:Mesh[]):Map<number,number>{
 const out=new Map<number,number>();
 for(const m of meshes)for(const id of (m.metadata.faceToBuilding as number[]))
  out.set(id,(out.get(id)??0)+1);
 return out;
}

export async function run(input:Inputs,check:Check):Promise<string[]>{
 const notes:string[]=[];
 const engine=new NullEngine();
 const scene=new Scene(engine);
 const camera=new ArcRotateCamera('c',0,.9,600,new Vector3(input.pop.x,0,input.pop.z),scene);
 scene.activeCamera=camera;
 const materials=createMaterials(scene);

 // --- D1 : mêmes triangles, mêmes bâtiments, un maillage propre au monument.
 setHeritageFootprints(new FootprintIndex());
 const merged=createTile(scene,clone(input.tile),materials);
 const mergedTris=triangles(merged),mergedFaces=facesByBuilding(merged);
 merged.forEach(m=>m.dispose());
 setHeritageFootprints(new FootprintIndex(parseFootprintTable(input.table)));
 let tile=createTile(scene,clone(input.tile),materials);
 const own=tile.filter(m=>m.metadata.heritageIgnId===input.ignId);
 check(own.length===2,'D1 : un maillage mur + un maillage toit propres au monument');
 check(triangles(tile)===mergedTris,'D1 : aucun triangle perdu ni dupliqué');
 const split=facesByBuilding(tile);
 check([...mergedFaces].every(([id,n])=>split.get(id)===n),
  'D1 : chaque bâtiment garde toutes ses faces');
 const hdvIndex=input.tile.buildings.findIndex(b=>b.id===input.ignId);
 check(tile.filter(m=>!m.metadata.heritageIgnId).every(m=>
  !(m.metadata.faceToBuilding as number[]).includes(hdvIndex)),
  'D1 : le monument ne figure plus dans les lots fusionnés');
 notes.push('Tuile '+input.tile.id+' : '+merged.length+' maillages fusionnés avant, '+
  tile.length+' après (+'+(tile.length-merged.length)+' draw calls au plus).');

 // --- D2 : sélection Babylon réelle sur l'extrusion masquée.
 const down=(x:number,z:number)=>new Ray(new Vector3(x,500,z),new Vector3(0,-1,0),1000);
 const pickAt=(x:number,z:number,pred:((m:any)=>boolean)|null=isBuildingPickProxy)=>{
  // null = sélection Babylon par défaut (isEnabled, isVisible, isPickable).
  const hit=scene.pickWithRay(down(x,z),pred??undefined);
  return hit?.hit&&hit.pickedMesh?
   getPickedBuilding(hit.pickedMesh as Mesh,hit.faceId):null;
 };
 check(pickAt(input.pop.x,input.pop.z)?.id===input.ignId,
  'D2 : le point POP sélectionne le monument avant remplacement');

 // --- D7 + LOD + allers-retours avec la bibliothèque réelle.
 const ownBox=extrusionSwap.footprintBox(input.ref);
 check(ownBox!==null,'D7 : emprise de l\'extrusion enregistrée');
 const box=ownBox!;
 const files:Record<string,unknown>={};
 const model=(tier:string,n:number,offsetX=0)=>{
  const g=fixtureBox({minX:box.minX-.5,minZ:box.minZ-.5,maxX:box.maxX+.5,maxZ:box.maxZ+.5},
   40,n,offsetX);
  return {schema:1,ref:input.ref,units:'m',coordinates:'paris-local-xyz',tier,
   sourceIds:['test-fixture'],parts:[{name:'test-fixture-'+tier,kind:'wall',
   positions:g.positions,indices:g.indices,sourceIds:['test-fixture']}]};
 };
 files['index.json']={schema:1,models:[{ref:input.ref,x:input.pop.x,z:input.pop.z,
  sourceIds:['test-fixture'],fullReplacement:true,
  // Valeur exigée par le moteur ; elle n'existe que dans ce banc d'essai.
  review:'measured-and-approved',
  lods:[{tier:'high',maxRadiusMeters:2500,file:input.ref+'-high.json'},
        {tier:'medium',maxRadiusMeters:2500,file:input.ref+'-medium.json'},
        {tier:'low',maxRadiusMeters:2500,file:input.ref+'-low.json'}]}]};
 files[input.ref+'-high.json']=model('high',6);
 files[input.ref+'-medium.json']=model('medium',3);
 files[input.ref+'-low.json']=model('low',2);
 let fetches=0;
 (globalThis as any).fetch=async(url:string)=>{
  fetches++;
  const name=String(url).split('/').pop()!;
  const body=files[name];
  return {ok:body!==undefined,json:async()=>JSON.parse(JSON.stringify(body))};
 };
 let clock=0;
 (globalThis as any).performance={now:()=>clock};
 const docs={canPublish:()=>true} as unknown as ArchitectureDossiers;
 const lib=new ArchitecturalModelLibrary(scene,docs,materials);
 await lib.init();
 const step=async(x:number,z:number,radius:number)=>{
  clock+=500;lib.update(x,z,radius,false);await tick();
 };
 const experts=()=>scene.meshes.filter(m=>m.name.startsWith('monument-mesure-'));
 const ownVisible=()=>own.every(m=>m.isVisible);
 const baselineMeshes=scene.meshes.length,baselineGeometries=scene.geometries.length;

 await step(input.pop.x,input.pop.z,300);
 check(experts().length===1&&experts()[0].name.endsWith('high'),'D7 : maquette haute chargée');
 check(!ownVisible(),'D7 : extrusion masquée après affichage de la maquette');
 check(own.every(m=>m.isEnabled()&&m.isPickable),'D2 : extrusion masquée encore activée');
 check(experts().every(m=>!m.isPickable),'D2 : maquette non sélectionnable');
 check(pickAt(input.pop.x,input.pop.z)?.id===input.ignId,
  'D2 : scene.pickWithRay sélectionne le monument via le proxy invisible');
 check(pickAt(input.pop.x,input.pop.z,null)?.id!==input.ignId,
  'D2 : sans prédicat, Babylon ignore bien un maillage invisible');
 check(tile.filter(m=>m.metadata.heritageIgnId!==input.ignId).every(m=>m.isVisible),
  'D1 : aucun voisin masqué');
 scene.render();
 const active=new Set(scene.getActiveMeshes().data.slice(0,scene.getActiveMeshes().length));
 check(own.every(m=>!active.has(m)),'Rendu : extrusion masquée absente des maillages rendus');
 check(experts().every(m=>active.has(m)),'Rendu : maquette rendue');

 await step(input.pop.x,input.pop.z,900);
 check(experts().length===1&&experts()[0].name.endsWith('medium'),
  'LOD : passage haut -> moyen sans double affichage');
 check(!ownVisible(),'LOD : extrusion toujours masquée');
 await step(input.pop.x+20000,input.pop.z,300);
 check(experts().length===0&&ownVisible(),'Caméra éloignée : maquette retirée, extrusion restituée');

 for(let i=0;i<25;i++){
  await step(input.pop.x,input.pop.z,i%2?300:900);
  await step(input.pop.x+20000,input.pop.z,300);
 }
 check(experts().length===0&&ownVisible(),'25 allers-retours : état initial restitué');
 check(scene.meshes.length===baselineMeshes,'25 allers-retours : aucun maillage orphelin ('+
  scene.meshes.length+' / '+baselineMeshes+')');
 check(scene.geometries.length===baselineGeometries,'25 allers-retours : aucune géométrie orpheline');

 // Tuile déchargée puis rechargée pendant que la maquette est active.
 await step(input.pop.x,input.pop.z,300);
 tile.forEach(m=>m.dispose());
 check(extrusionSwap.footprintBox(input.ref)===null,'Tuile déchargée : emprise désenregistrée');
 tile=createTile(scene,clone(input.tile),materials);
 const own2=tile.filter(m=>m.metadata.heritageIgnId===input.ignId);
 check(own2.length===2&&own2.every(m=>!m.isVisible),
  'Tuile rechargée tardivement : extrusion masquée dès sa création');
 check(pickAt(input.pop.x,input.pop.z)?.id===input.ignId,
  'Tuile rechargée : sélection toujours possible');
 await step(input.pop.x+20000,input.pop.z,300);
 check(own2.every(m=>m.isVisible)&&experts().length===0,'Tuile rechargée : restitution complète');

 // Maquette introuvable : l'extrusion reste affichée.
 const savedHigh=files[input.ref+'-high.json'];
 delete files[input.ref+'-high.json'];
 await step(input.pop.x,input.pop.z,300);
 check(experts().length===0&&own2.every(m=>m.isVisible),
  'Échec de chargement : extrusion conservée, aucune maquette');
 files[input.ref+'-high.json']=savedHigh;
 await step(input.pop.x+20000,input.pop.z,300);

 // Maquette décalée de 60 m : rejetée, jamais rechargée.
 files[input.ref+'-medium.json']=model('medium',3,60);
 await step(input.pop.x,input.pop.z,900);
 check(experts().length===0&&own2.every(m=>m.isVisible),
  'Maquette hors emprise : rejetée, extrusion conservée');
 const before=fetches;
 await step(input.pop.x,input.pop.z,900);
 await step(input.pop.x,input.pop.z,900);
 check(fetches===before,'Maquette rejetée : pas de rechargement en boucle');
 const sel=pickAt(input.pop.x,input.pop.z);
 check(sel?.id===input.ignId,'Après rejet : sélection intacte');
 check(scene.meshes.filter(m=>m.name.startsWith('monument-mesure-')).length===0,
  'Après rejet : aucun maillage expert résiduel');
 engine.dispose();
 return notes;
}
