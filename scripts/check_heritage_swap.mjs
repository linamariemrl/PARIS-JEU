// R02-D1/D2/D3/D7 : table des emprises, bascule extrusion <-> maquette,
// proxy de sélection et ordre de bascule sûr. La maquette utilisée ici est
// un FAUX marqué `review: "test-fixture"`, défini dans ce test et jamais
// écrit dans public/ : le moteur n'accepte que `measured-and-approved`.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {
 parseFootprintTable,FootprintIndex,HeritageSwap,modelCoversFootprint,
 boxOfPositions,isBuildingPickProxy
} from '../src/heritageFootprints.ts';

// --- D3 : lecture stricte et index plusieurs-à-plusieurs -----------------
const A='BATIMENT0000000000000001',B='BATIMENT0000000000000002',
 C='BATIMENT0000000000000003';
const table=parseFootprintTable({schema:1,entries:[
 {ref:'PA00000001',ignIds:[A,B],parts:[],status:'ensemble'},
 {ref:'PA00000002',ignIds:[B],parts:[],status:'partie'},
 {ref:'PA00000003',ignIds:[C,C],parts:[],status:'doublon'},
 {ref:'PA00000001',ignIds:[C],parts:[],status:'référence répétée'},
 {ref:'osm:42',ignIds:[A],parts:[],status:'référence invalide'},
 {ref:'PA00000004',ignIds:['BATIMENT42'],parts:[],status:'id invalide'},
 {ref:'PA00000005',ignIds:[A],status:'sans parts'}
]});
assert.deepEqual(table.entries.map(e=>e.ref),['PA00000001','PA00000002','PA00000003']);
assert.deepEqual(table.entries[2].ignIds,[C]);
assert.throws(()=>parseFootprintTable({schema:2,entries:[]}));
assert.throws(()=>parseFootprintTable(null));
const index=new FootprintIndex(table);
assert.deepEqual([...index.ignIdsOf('PA00000001')],[A,B]);
assert.deepEqual([...index.refsOf(B)],['PA00000001','PA00000002']);
assert.ok(index.isTracked(C));
assert.ok(!index.isTracked('BATIMENT0000000000000009'));

// --- D7 : contrôle d'emprise -----------------------------------------------
const box=(minX,minZ,maxX,maxZ)=>({minX,minZ,maxX,maxZ});
const fp=box(0,0,40,20);
assert.ok(modelCoversFootprint(box(-1,-1,41,21),fp));
assert.ok(modelCoversFootprint(box(1.5,1.5,38.5,18.5),fp),'tolérance de 2 m');
assert.ok(!modelCoversFootprint(box(30,0,70,20),fp),'maquette décalée');
assert.ok(!modelCoversFootprint(box(-400,-400,400,400),fp),'maquette démesurée');
assert.equal(boxOfPositions([0,0,0,NaN,0,1]),null,'sommet non fini');
assert.deepEqual(boxOfPositions([1,5,2,-3,9,4]),box(-3,2,1,4));

// --- D1/D2/D7 : cycle complet ---------------------------------------------
const mesh=()=>({isVisible:true,isPickable:false,enabled:true,
 metadata:{faceToBuilding:[0,0]},isEnabled(){return this.enabled;}});
const rejected=[];
const swap=new HeritageSwap(()=>index,(ref,id)=>rejected.push([ref,id]));
const fixture={review:'test-fixture',ref:'PA00000001',box:box(-1,-1,81,21)};
assert.equal(swap.activate(fixture.ref,fixture.box),false,
 'aucune extrusion chargée : rien à valider, rien à masquer');
const mA=mesh(),mB=mesh(),mC=mesh();
swap.register(A,mA,box(0,0,40,20));
swap.register(B,mB,box(40,0,80,20));
swap.register(C,mC,box(500,500,520,520));
assert.ok(mA.isPickable&&mA.isVisible&&mB.isVisible);
// Maquette rejetée : l'extrusion reste affichée.
assert.equal(swap.activate(fixture.ref,box(-1,-1,39,21)),false);
assert.ok(mA.isVisible&&mB.isVisible&&!swap.isActive(fixture.ref));
// Maquette validée puis affichée : l'extrusion est masquée, sans
// désactivation ni réécriture, et reste un proxy de sélection.
assert.ok(swap.activate(fixture.ref,fixture.box));
assert.ok(!mA.isVisible&&!mB.isVisible&&mC.isVisible,'voisin non touché');
assert.ok(isBuildingPickProxy(mA)&&isBuildingPickProxy(mB),
 'extrusion masquée toujours sélectionnable');
assert.ok(!isBuildingPickProxy({isPickable:false,isEnabled:()=>true,
 metadata:{}}),'maillage expert jamais sélectionnable');
mA.enabled=false;
assert.ok(!isBuildingPickProxy(mA),'maillage désactivé jamais sélectionné');
mA.enabled=true;
// Changement de LOD : nouvelle maquette activée, extrusion toujours masquée.
assert.ok(swap.activate(fixture.ref,box(-.5,-.5,80.5,20.5)));
assert.ok(!mA.isVisible);
// Plusieurs-à-plusieurs : la partie couvre B seule.
assert.ok(swap.activate('PA00000002',box(40,0,80,20)));
swap.deactivate(fixture.ref);
assert.ok(mA.isVisible,'A restituée');
assert.ok(!mB.isVisible,'B reste masquée par la partie active');
swap.deactivate('PA00000002');
assert.ok(mB.isVisible,'retour arrière complet');
// Tuile rechargée APRÈS la maquette : extrusion masquée à sa création.
assert.ok(swap.activate(fixture.ref,fixture.box));
swap.unregister(A,mA);
const mA2=mesh();
swap.register(A,mA2,box(0,0,40,20));
assert.equal(mA2.isVisible,false);
// Tuile supplémentaire hors de la maquette : maquette rejetée, extrusions
// restituées avant le retrait du maillage expert.
const mB2=mesh();
swap.register(B,mB2,box(300,0,340,20));
assert.deepEqual(rejected,[[fixture.ref,B]]);
assert.ok(!swap.isActive(fixture.ref));
assert.ok(mA2.isVisible&&mB.isVisible&&mB2.isVisible);

// --- Table publiée ----------------------------------------------------------
const doc=JSON.parse(readFileSync(new URL(
 '../public/data/metropole/architecture/heritage-footprints.json',import.meta.url)));
const published=parseFootprintTable(doc);
assert.equal(published.entries.length,doc.entries.length,'aucune entrée rejetée');
const dossiers=JSON.parse(readFileSync(new URL(
 '../public/data/metropole/architecture/dossiers.json',import.meta.url)));
assert.deepEqual(published.entries.map(e=>e.ref).sort(),
 dossiers.dossiers.filter(d=>d.ref).map(d=>d.ref).sort(),
 'une entrée par dossier doté d\'une référence POP');
const hdv=published.entries.find(e=>e.ref==='PA00086319');
assert.deepEqual(hdv.ignIds,['BATIMENT0000000245157267']);
for(const e of published.entries)
 assert.equal(e.parts.length,0,'aucune partie certifiée à ce jour');
const statuses=new Set(['single-footprint-pop-point','multiple-footprints-pop-point',
 'pop-point-in-enclosed-courtyard','no-footprint-found']);
for(const e of doc.entries){
 assert.ok(statuses.has(e.status),'statut inconnu '+e.status);
 assert.equal(e.status==='no-footprint-found',e.ignIds.length===0,e.ref);
 if(!e.ignIds.length)assert.ok('nearestFootprintMeters' in e,
  'référence non rattachée sans distance documentée : '+e.ref);
 if(e.status==='pop-point-in-enclosed-courtyard')
  assert.equal(e.ignIds.length,1,'une cour fermée désigne un seul bâtiment');
}
// Cour fermée : les Invalides sont rattachés au bâtiment qui entoure la cour.
assert.deepEqual(published.entries.find(e=>e.ref==='PA00088714').ignIds,
 ['BATIMENT0000002007005295']);
const ids=new Set();
for(const dir of ['../public/data/4e/tiles/','../public/data/metropole/buildings/tiles/']){
 const url=new URL(dir,import.meta.url);
 for(const name of readdirSync(url)){
  const text=readFileSync(new URL(name,url),'utf8');
  for(const m of text.matchAll(/"id":"(BATIMENT\d{16})"/g))ids.add(m[1]);
 }
}
for(const e of published.entries)for(const id of e.ignIds)
 assert.ok(ids.has(id),'emprise absente des tuiles : '+id);
const tracked=new FootprintIndex(published).size;
console.log('Emprises patrimoniales : '+published.entries.length+
 ' références, '+tracked+' emprises séparées ; bascule par visibilité, '+
 'proxy de sélection et ordre de bascule sûr vérifiés.');
