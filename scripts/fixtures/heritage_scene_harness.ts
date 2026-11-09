// Banc d'essai Babylon.js réel (NullEngine, sans GPU) pour la bascule
// extrusion IGN <-> maquette experte. Regroupé par esbuild depuis
// scripts/check_heritage_scene.mjs. Rien ici n'est publié.
//
// Les « maquettes » sont des FAUX (`test-fixture`) servis par un fetch
// simulé : une toiture plate triangulée sur le VRAI polygone IGN (cours
// comprises), et un pavé plein de même boîte englobante qui doit être
// rejeté. Ils ne sortent jamais de ce banc et ne représentent aucune
// architecture réelle ; ils éprouvent le mécanisme, pas un monument.
import {NullEngine,Scene,ArcRotateCamera,Vector3,Ray,Mesh} from '@babylonjs/core';
import {createMaterials,createTile,getPickedBuilding} from '../../src/buildings';
import {ArchitecturalModelLibrary,extrusionSwap} from '../../src/architectureModels';
import {FootprintIndex,parseFootprintTable,setHeritageFootprints,
 isBuildingPickProxy} from '../../src/heritageFootprints';
import type {Box2} from '../../src/heritageFootprints';
import earcut from 'earcut';
import {project} from '../../src/geo';
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
 check(extrusionSwap.footprintBox(input.ref)!==null,'D7 : emprise de l\'extrusion enregistrée');
 const building=input.tile.buildings[hdvIndex];
 const rings=building.polygons.map(poly=>poly.map(r=>{
  const pts=r.map(p=>building.localCoordinates?{x:p[0],z:p[1]}:project(p));
  const f=pts[0],l=pts[pts.length-1];
  if(pts.length>2&&Math.hypot(f.x-l.x,f.z-l.z)<.01)pts.pop();
  return pts;
 }));
 /** Toiture plate triangulée sur le polygone IGN réel, cours comprises. */
 const footprintRoof=(offsetX=0,y=40)=>{
  const positions:number[]=[],indices:number[]=[];
  for(const poly of rings){
   const flat:number[]=[],holes:number[]=[];let n=0;
   poly.forEach((r,i)=>{if(i>0)holes.push(n);for(const q of r){flat.push(q.x+offsetX,q.z);n++;}});
   const base=positions.length/3;
   for(let i=0;i<flat.length;i+=2)positions.push(flat[i],y,flat[i+1]);
   for(const t of earcut(flat,holes,2))indices.push(base+t);
  }
  return {positions,indices};
 };
 const asFile=(ref:string,tier:string,g:{positions:number[];indices:number[]})=>({
  schema:1,ref,units:'m',coordinates:'paris-local-xyz',tier,sourceIds:['test-fixture'],
  parts:[{name:'test-fixture-'+tier,kind:'roof',positions:g.positions,
   indices:g.indices,sourceIds:['test-fixture']}]});
 const model=(tier:string,offsetX=0)=>asFile(input.ref,tier,footprintRoof(offsetX));
 const lods=(ref:string,max=2500)=>[
  {tier:'high',maxRadiusMeters:max,file:ref+'-high.json'},
  {tier:'medium',maxRadiusMeters:max,file:ref+'-medium.json'},
  {tier:'low',maxRadiusMeters:max,file:ref+'-low.json'}];
 const indexOf=(entries:{ref:string;max?:number}[])=>({schema:1,models:entries.map(e=>({
  ref:e.ref,x:input.pop.x,z:input.pop.z,sourceIds:['test-fixture'],fullReplacement:true,
  // Valeur exigée par le moteur ; elle n'existe que dans ce banc d'essai.
  review:'measured-and-approved',lods:lods(e.ref,e.max)}))});
 type Served=unknown|{network:true}|{truncated:true}|{gate:Promise<void>;body:unknown};
 let files:Record<string,Served>={};
 let fetches=0;
 const fetched:string[]=[];
 (globalThis as any).fetch=async(url:string)=>{
  fetches++;
  const name=String(url).split('/').pop()!;
  fetched.push(name);
  let body=files[name] as any;
  if(body?.network)throw new TypeError('Failed to fetch (réseau simulé indisponible)');
  if(body?.gate){await body.gate;body=body.body;}
  return {ok:body!==undefined,json:async()=>{
   if(body?.truncated)throw new SyntaxError('Unexpected end of JSON input');
   return JSON.parse(JSON.stringify(body));}};
 };
 let clock=0;
 (globalThis as any).performance={now:()=>clock};
 // Seule la partie « facade-test » est certifiée dans ce banc d'essai.
 const docs={canPublish:()=>true,
  canPublishPart:(_r:string,partId:string)=>partId==='facade-test'} as unknown as ArchitectureDossiers;
 let lib=new ArchitecturalModelLibrary(scene,docs,materials);
 const fresh=async(served:Record<string,Served>)=>{
  files=served;lib=new ArchitecturalModelLibrary(scene,docs,materials);await lib.init();
 };
 const step=async(x:number,z:number,radius:number)=>{
  clock+=500;lib.update(x,z,radius,false);await tick();
 };
 const near=(r:number)=>step(input.pop.x,input.pop.z,r);
 const away=()=>step(input.pop.x+20000,input.pop.z,300);
 const experts=()=>scene.meshes.filter(m=>m.name.startsWith('monument-mesure-'));
 const ownVisible=()=>own.every(m=>m.isVisible);
 const baselineMeshes=scene.meshes.length,baselineGeometries=scene.geometries.length;
 const good={'index.json':indexOf([{ref:input.ref}]),
  [input.ref+'-high.json']:model('high'),[input.ref+'-medium.json']:model('medium'),
  [input.ref+'-low.json']:model('low')};
 await fresh({...good});

 await near(300);
 check(experts().length===1&&experts()[0].name.endsWith('high'),'D7 : maquette haute chargée');
 check(!ownVisible(),'D7 : extrusion masquée après affichage de la maquette');
 const report=extrusionSwap.reports.get(input.ref);
 check(report&&report.coverage>=.95&&report.spill<=.05,
  'Polygones : toiture sur le polygone IGN réel acceptée (couverture '+
  (report?(100*report.coverage).toFixed(1):'?')+' %, débordement '+
  (report?(100*report.spill).toFixed(1):'?')+' %)');
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

 await near(900);
 check(experts().length===1&&experts()[0].name.endsWith('medium'),
  'LOD : passage haut -> moyen sans double affichage');
 check(!ownVisible(),'LOD : extrusion toujours masquée');
 await away();
 check(experts().length===0&&ownVisible(),'Caméra éloignée : maquette retirée, extrusion restituée');

 for(let i=0;i<25;i++){await near(i%2?300:900);await away();}
 check(experts().length===0&&ownVisible(),'25 allers-retours : état initial restitué');
 check(scene.meshes.length===baselineMeshes,'25 allers-retours : aucun maillage orphelin ('+
  scene.meshes.length+' / '+baselineMeshes+')');
 check(scene.geometries.length===baselineGeometries,'25 allers-retours : aucune géométrie orpheline');

 // Tuile déchargée puis rechargée pendant que la maquette est active.
 await near(300);
 tile.forEach(m=>m.dispose());
 check(extrusionSwap.footprintBox(input.ref)===null,'Tuile déchargée : emprise désenregistrée');
 tile=createTile(scene,clone(input.tile),materials);
 const own2=tile.filter(m=>m.metadata.heritageIgnId===input.ignId);
 check(own2.length===2&&own2.every(m=>!m.isVisible),
  'Tuile rechargée tardivement : extrusion masquée dès sa création');
 check(pickAt(input.pop.x,input.pop.z)?.id===input.ignId,
  'Tuile rechargée : sélection toujours possible');
 await away();
 check(own2.every(m=>m.isVisible)&&experts().length===0,'Tuile rechargée : restitution complète');
 const visible2=()=>own2.every(m=>m.isVisible);

 // --- Échecs : fichier absent, réseau coupé, JSON tronqué, triangle mal formé.
 await fresh({...good,[input.ref+'-high.json']:undefined});
 await near(300);
 check(experts().length===0&&visible2(),'Fichier absent : extrusion conservée, aucune maquette');
 await away();
 await fresh({...good,[input.ref+'-high.json']:{network:true}});
 await near(300);
 check(experts().length===0&&visible2(),'Réseau coupé : extrusion conservée, aucune maquette');
 files[input.ref+'-high.json']=model('high');
 await near(300);
 check(experts().length===1&&!visible2(),'Réseau rétabli : maquette chargée au passage suivant');
 await away();
 await fresh({...good,[input.ref+'-high.json']:{truncated:true}});
 await near(300);
 check(experts().length===0&&visible2(),'JSON tronqué : extrusion conservée, aucune maquette');
 await away();
 const broken=footprintRoof();broken.indices[1]=broken.indices[0];
 await fresh({...good,[input.ref+'-high.json']:asFile(input.ref,'high',broken)});
 await near(300);
 check(experts().length===0&&visible2(),'Triangle mal formé : maquette rejetée');
 await away();

 // --- Contrôle géométrique sur l'emprise réelle : même boîte, forme fausse.
 const ownBox=extrusionSwap.footprintBox(input.ref)!;
 await fresh({...good,[input.ref+'-low.json']:asFile(input.ref,'low',fixtureBox(ownBox,40,4))});
 await near(2000);
 const solid=extrusionSwap.reports.get(input.ref);
 check(experts().length===0&&visible2(),'Pavé plein de même boîte (cours comblées) : rejeté'+
  (solid?' (débordement '+(100*solid.spill).toFixed(1)+' %)':''));
 await away();
 await fresh({...good,[input.ref+'-medium.json']:model('medium',6)});
 await near(900);
 check(experts().length===0&&visible2(),'Toiture exacte décalée de 6 m : rejetée');
 const before=fetches;
 await near(900);await near(900);
 check(fetches===before,'Maquette rejetée : pas de rechargement en boucle');
 check(pickAt(input.pop.x,input.pop.z)?.id===input.ignId,'Après rejet : sélection intacte');
 await away();

 // --- Concurrence : le niveau voulu change pendant que la requête est en vol.
 let release=()=>{};
 const gate=new Promise<void>(r=>{release=r;});
 await fresh({...good,[input.ref+'-high.json']:{gate,body:model('high')}});
 await near(300);
 check(experts().length===0&&visible2(),'Requête en vol : rien n\'est encore masqué');
 await near(900);
 release();await tick();
 check(experts().every(m=>!m.name.endsWith('high')),'Réponse périmée (haut) : jetée à l\'arrivée');
 await near(900);
 check(experts().length===1&&experts()[0].name.endsWith('medium')&&!visible2(),
  'Après la course : seul le niveau moyen est affiché');
 await away();
 check(experts().length===0&&visible2(),'Course : restitution complète');

 // --- Plusieurs-à-plusieurs dans la scène : deux références, une emprise.
 const second='PA99999998';
 const table=parseFootprintTable(input.table);
 table.entries.push({ref:second,ignIds:[input.ignId],parts:[],status:'test-fixture'});
 setHeritageFootprints(new FootprintIndex(table));
 tile.forEach(m=>m.dispose());
 tile=createTile(scene,clone(input.tile),materials);
 const own3=tile.filter(m=>m.metadata.heritageIgnId===input.ignId);
 const visible3=()=>own3.every(m=>m.isVisible);
 const secondFiles=Object.fromEntries(['high','medium','low'].map(t=>
  [second+'-'+t+'.json',asFile(second,t,footprintRoof())]));
 await fresh({...good,...secondFiles,'index.json':indexOf([{ref:input.ref},{ref:second,max:600}])});
 await near(300);
 await near(300);
 check(experts().length===1&&!visible3(),
  'Deux références sur une emprise : une seule maquette affichée, jamais deux');
 const first=experts()[0].name;
 await near(900);
 await near(900);
 check(experts().length===1&&!visible3(),'Une référence sort du champ : emprise toujours remplacée');
 await away();
 check(experts().length===0&&visible3(),'Plusieurs-à-plusieurs : restitution complète');
 notes.push('Plusieurs-à-plusieurs : première maquette affichée = '+first+'.');
 // --- D4 : parties certifiées superposées, jamais masquantes.
 // Bande posée sur l'arête extérieure la plus longue de l'emprise réelle.
 const outer=rings[0][0];
 let ea=outer[0],eb=outer[1],best=0;
 for(let i=0;i<outer.length;i++){const a=outer[i],b=outer[(i+1)%outer.length];
  const l=Math.hypot(b.x-a.x,b.z-a.z);if(l>best){best=l;ea=a;eb=b;}}
 const ux=(eb.x-ea.x)/best,uz=(eb.z-ea.z)/best;
 // Normale vers l'intérieur : celle dont un point proche est dans l'emprise.
 const probe=(s:number)=>({x:(ea.x+eb.x)/2-uz*s,z:(ea.z+eb.z)/2+ux*s});
 const inside=(p:{x:number;z:number})=>{let c=false;for(let i=0,j=outer.length-1;i<outer.length;j=i++){
  const a=outer[i],b=outer[j];if((a.z>p.z)!==(b.z>p.z)&&p.x<(b.x-a.x)*(p.z-a.z)/(b.z-a.z)+a.x)c=!c;}return c;};
 const sgn=inside(probe(2))?1:-1;
 const nx=-uz*sgn,nz=ux*sgn;
 const strip=(shift=0,inward=1,outward=.5):[number,number][]=>{
  const a={x:ea.x+nx*shift,z:ea.z+nz*shift},b={x:eb.x+nx*shift,z:eb.z+nz*shift};
  return [[a.x-nx*outward,a.z-nz*outward],[b.x-nx*outward,b.z-nz*outward],
   [b.x+nx*inward,b.z+nz*inward],[a.x+nx*inward,a.z+nz*inward]];};
 /** Mur vertical sur l'arête (+ décalage), subdivisé : façade factice. */
 const wall=(shift=0,n=4)=>{const positions:number[]=[],indices:number[]=[];
  const a={x:ea.x+nx*shift,z:ea.z+nz*shift};
  for(let i=0;i<=n;i++)for(let j=0;j<=1;j++)
   positions.push(a.x+ux*best*i/n,j*18,a.z+uz*best*i/n);
  for(let i=0;i<n;i++){const k=2*i;indices.push(k,k+2,k+1,k+1,k+2,k+3);}
  return {positions,indices};};
 const partFile=(partId:string,tier:string,g:{positions:number[];indices:number[]})=>({
  ...asFile(input.ref,tier,g),partId});
 const partEntry=(partId:string,footprint:[number,number][],max=2500)=>({
  ref:input.ref,x:input.pop.x,z:input.pop.z,sourceIds:['test-fixture'],
  review:'measured-and-approved',replacement:'partial',partId,partFootprint:footprint,
  lods:['high','medium','low'].map(t=>({tier:t,maxRadiusMeters:max,
   file:input.ref+'-'+partId+'-'+t+'.json'}))});
 const partFiles=(partId:string,g:()=>{positions:number[];indices:number[]})=>
  Object.fromEntries(['high','medium','low'].map(t=>[input.ref+'-'+partId+'-'+t+'.json',partFile(partId,t,g())]));
 const partMeshes=(id:string)=>experts().filter(m=>m.name.includes('-'+id+'-'));
 await fresh({'index.json':{schema:1,models:[partEntry('facade-test',strip()),
   partEntry('facade-inconnue',strip())]},
  ...partFiles('facade-test',()=>wall()),...partFiles('facade-inconnue',()=>wall())});
 fetched.length=0;
 await near(300);
 check(partMeshes('facade-test').length===1&&visible3(),
  'D4 : partie certifiée superposée, extrusion conservée visible');
 check(partMeshes('facade-test').every(m=>!m.isPickable&&
  (m.material as any)?.zOffset===-2),'D4 : partie non sélectionnable, décalage de profondeur seul');
 check(pickAt(input.pop.x,input.pop.z)?.id===input.ignId,'D4 : sélection inchangée (une seule cible)');
 check(!fetched.some(f=>f.includes('facade-inconnue'))&&partMeshes('facade-inconnue').length===0,
  'D4 : partie non certifiée jamais téléchargée ni affichée');
 await near(900);
 check(partMeshes('facade-test').length===1&&partMeshes('facade-test')[0].name.endsWith('medium'),
  'D4 : partie, LOD moyen sans double affichage');
 await near(2000);
 check(partMeshes('facade-test').length===1&&partMeshes('facade-test')[0].name.endsWith('low'),
  'D4 : partie, LOD bas');
 await away();
 check(experts().length===0&&visible3(),'D4 : partie retirée, rien à restituer');
 // Partie déclarée dans une cour (hors emprise IGN) : rejetée.
 const hole=rings[0][1];
 const hx=hole.reduce((a,p)=>a+p.x,0)/hole.length,hz=hole.reduce((a,p)=>a+p.z,0)/hole.length;
 const inCourt:[number,number][]=[[hx-2,hz-2],[hx+2,hz-2],[hx+2,hz+2],[hx-2,hz+2]];
 const courtWall=()=>({positions:[hx-1.5,0,hz,hx+1.5,0,hz,hx+1.5,10,hz,hx-1.5,10,hz],indices:[0,1,2,0,2,3]});
 await fresh({'index.json':{schema:1,models:[partEntry('facade-test',inCourt)]},
  ...partFiles('facade-test',courtWall)});
 await near(300);
 check(partMeshes('facade-test').length===0&&visible3(),'D4 : partie déclarée dans une cour : rejetée');
 await away();
 // Maquette de partie débordant de son emprise déclarée (3 m) : rejetée.
 await fresh({'index.json':{schema:1,models:[partEntry('facade-test',strip())]},
  ...partFiles('facade-test',()=>wall(3))});
 await near(300);
 check(partMeshes('facade-test').length===0&&visible3(),'D4 : sommets hors emprise déclarée : rejetée');
 await away();
 // Maquette complète et partie sur la même emprise : jamais les deux.
 await fresh({...good,...partFiles('facade-test',()=>wall()),
  'index.json':{schema:1,models:[...indexOf([{ref:input.ref,max:600}]).models,
   partEntry('facade-test',strip())]}});
 await near(300);await near(300);
 check(experts().length===1&&!partMeshes('facade-test').length&&!visible3(),
  'D4 : maquette complète active, partie non superposée');
 for(let i=0;i<6;i++)await near(900);
 check(partMeshes('facade-test').length===1&&experts().length===1&&visible3(),
  'D4 : maquette complète sortie du champ, partie superposée à l\'extrusion restituée');
 await away();
 check(experts().length===0&&visible3(),'D4 : restitution complète');

 // --- R03-B1 : partie de B déjà affichée, puis maquette complète de A sur
 // la même emprise IGN (références distinctes) : la partie de B doit
 // être retirée, puis revenir quand A sort du champ.
 const partEntryFor=(ref:string,partId:string,footprint:[number,number][],max=2500)=>({
  ...partEntry(partId,footprint,max),ref,
  lods:['high','medium','low'].map(t=>({tier:t,maxRadiusMeters:max,file:ref+'-'+partId+'-'+t+'.json'}))});
 const partFilesFor=(ref:string,partId:string,g:()=>{positions:number[];indices:number[]})=>
  Object.fromEntries(['high','medium','low'].map(t=>[ref+'-'+partId+'-'+t+'.json',
   {...asFile(ref,t,g()),partId}]));
 const bPart=()=>experts().filter(m=>m.name.includes(second+'-facade-test'));
 await fresh({...good,...partFilesFor(second,'facade-test',()=>wall()),
  'index.json':{schema:1,models:[...indexOf([{ref:input.ref,max:600}]).models,
   partEntryFor(second,'facade-test',strip())]}});
 await near(900);
 check(bPart().length===1&&visible3(),'B1 : partie de B affichée, extrusion visible');
 await near(300);await near(300);
 check(experts().filter(m=>m.name.includes(input.ref+'-test-fixture')).length===1&&!visible3(),
  'B1 : maquette complète de A active sur l\'emprise partagée');
 check(bPart().length===0,'B1 : partie de B retirée (règle déduite de l\'index IGN, pas de la référence)');
 for(let i=0;i<6;i++)await near(900);
 check(bPart().length===1&&experts().length===1&&visible3(),
  'B1 : A sortie du champ, partie de B revenue, extrusion restituée');
 // Réseau coupé pour A pendant que la partie de B est affichée (LOD haut).
 files[input.ref+'-high.json']={network:true};
 await near(300);await near(300);
 check(bPart().length===1&&visible3()&&!experts().some(m=>m.name.includes(input.ref+'-test-fixture')),
  'B1 : A indisponible (réseau) : partie de B conservée, extrusion visible');
 check(bPart()[0]?.name.endsWith('high'),'B1 : partie de B passée au LOD haut');
 await away();
 check(experts().length===0&&visible3(),'B1 : restitution complète');

 // --- D6 : hystérésis, pas d'allers-retours près d'un seuil.
 await fresh({...good});
 await near(300);
 const loads0=fetches;
 for(const r of [660,690,640,695,610,680])await near(r);
 check(experts().length===1&&experts()[0].name.endsWith('high')&&fetches===loads0,
  'D6 : orbite entre 610 et 695 m : niveau haut conservé, aucun rechargement');
 await near(720);
 check(experts()[0]?.name.endsWith('medium'),'D6 : au-delà de 700 m : passage au niveau moyen');
 await near(650);
 check(experts()[0]?.name.endsWith('medium'),'D6 : retour à 650 m : niveau moyen conservé');
 await near(590);
 check(experts()[0]?.name.endsWith('high'),'D6 : sous 600 m : retour au niveau haut');
 await away();
 check(scene.meshes.filter(m=>m.name.startsWith('monument-mesure-')).length===0,
  'Fin : aucun maillage expert résiduel');
 engine.dispose();
 return notes;
}
