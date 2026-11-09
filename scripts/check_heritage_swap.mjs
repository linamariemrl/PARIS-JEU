// R02-D1/D2/D3/D7 : table des emprises, bascule extrusion <-> maquette,
// proxy de sélection et ordre de bascule sûr. La maquette utilisée ici est
// un FAUX marqué `review: "test-fixture"`, défini dans ce test et jamais
// écrit dans public/ : le moteur n'accepte que `measured-and-approved`.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {
 parseFootprintTable,FootprintIndex,HeritageSwap,modelCoversFootprint,
 boxOfPositions,isBuildingPickProxy,footprintShape,modelShapeFromParts,
 polygonCoverage,partFits
} from '../src/heritageFootprints.ts';
import {chooseTier} from '../src/lodHysteresis.ts';
import {ArchitectureDossiers} from '../src/architectureDossiers.ts';

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

// --- Contrôle géométrique réel : polygones, cours, mauvaise forme ---------
const ring=(pts)=>pts.map(([x,z])=>({x,z}));
const rect=(x0,z0,x1,z1)=>footprintShape([[ring([[x0,z0],[x1,z0],[x1,z1],[x0,z1]])]]);
const quad=(x0,z0,x1,z1,y=10)=>({positions:[x0,y,z0,x1,y,z0,x1,y,z1,x0,y,z1],
 indices:[0,1,2,0,2,3]});
const flat=(...quads)=>modelShapeFromParts(quads.map(q=>quad(...q)));
// Cour fermée : emprise 0..40 avec cour 10..30.
const court=footprintShape([[ring([[0,0],[40,0],[40,40],[0,40]]),
 ring([[10,10],[30,10],[30,30],[10,30]])]]);
const filled=flat([0,0,40,40]);
const ringModel=flat([0,0,40,10],[0,30,40,40],[0,10,10,30],[30,10,40,30]);
assert.ok(modelCoversFootprint(filled.box,court.box),'la boîte seule accepterait');
assert.ok(!polygonCoverage(filled,[court]).ok,'cour comblée : débordement rejeté');
assert.ok(polygonCoverage(ringModel,[court]).ok,'anneau conforme accepté');
// Même boîte, forme fausse : L contre L miroir.
const L=footprintShape([[ring([[0,0],[40,0],[40,10],[10,10],[10,40],[0,40]])]]);
const mirror=flat([0,30,40,40],[30,0,40,30]);
assert.deepEqual(mirror.box,{minX:0,minZ:0,maxX:40,maxZ:40});
assert.ok(modelCoversFootprint(mirror.box,L.box));
const lr=polygonCoverage(mirror,[L]);
assert.ok(!lr.ok&&lr.coverage<.5,'forme fausse de même boîte rejetée');
assert.ok(polygonCoverage(flat([0,0,40,10],[0,10,10,40]),[L]).ok,'L exact accepté');
// Aile étroite (1,5 m x 30 m, 5,3 % de l'aire) absente : rejet, comme la
// validation exacte Shapely (cas identique dans test_model_geometry_shapely).
const winged=footprintShape([[ring([[0,0],[40,0],[40,20],[20.75,20],[20.75,50],[19.25,50],[19.25,20],[0,20]])]]);
const wr=polygonCoverage(flat([0,0,40,20]),[winged]);
assert.ok(!wr.ok&&wr.coverage<.95,'aile étroite manquante rejetée ('+wr.coverage.toFixed(3)+')');
assert.ok(polygonCoverage(flat([0,0,40,20],[19.25,20,20.75,50]),[winged]).ok,'aile présente acceptée');
// Murs seuls (aucune projection horizontale) : rejet.
const walls=modelShapeFromParts([{positions:[0,0,0,40,0,0,40,20,0,0,20,0],indices:[0,1,2,0,2,3]}]);
assert.ok(!polygonCoverage(walls,[rect(0,0,40,20)]).ok,'murs seuls rejetés');
// Léger écart de bord (< 1 m) toléré, décalage de 3 m rejeté.
assert.ok(polygonCoverage(flat([.6,-.5,40.4,20.5]),[rect(0,0,40,20)]).ok);
assert.ok(!polygonCoverage(flat([3,0,43,20]),[rect(0,0,40,20)]).ok);

// --- D1/D2/D7 : cycle complet ---------------------------------------------
const mesh=()=>({isVisible:true,isPickable:false,enabled:true,
 metadata:{faceToBuilding:[0,0]},isEnabled(){return this.enabled;}});
const rejected=[];
const swap=new HeritageSwap(()=>index,(ref,id)=>rejected.push([ref,id]));
const fixture={review:'test-fixture',ref:'PA00000001',shape:flat([-.5,-.5,80.5,20.5])};
assert.equal(swap.activate(fixture.ref,fixture.shape),false,
 'aucune extrusion chargée : rien à valider, rien à masquer');
const mA=mesh(),mB=mesh(),mC=mesh();
swap.register(A,mA,rect(0,0,40,20));
swap.register(B,mB,rect(40,0,80,20));
swap.register(C,mC,rect(500,500,520,520));
assert.ok(mA.isPickable&&mA.isVisible&&mB.isVisible);
// Maquette rejetée : l'extrusion reste affichée.
assert.equal(swap.activate(fixture.ref,flat([-1,-1,39,21])),false,
 'maquette couvrant A seule : B non couverte, rejet');
assert.ok(mA.isVisible&&mB.isVisible&&!swap.isActive(fixture.ref));
// Maquette validée puis affichée : l'extrusion est masquée, sans
// désactivation ni réécriture, et reste un proxy de sélection.
assert.ok(swap.activate(fixture.ref,fixture.shape));
assert.ok(!mA.isVisible&&!mB.isVisible&&mC.isVisible,'voisin non touché');
assert.ok(isBuildingPickProxy(mA)&&isBuildingPickProxy(mB),
 'extrusion masquée toujours sélectionnable');
assert.ok(!isBuildingPickProxy({isPickable:false,isEnabled:()=>true,
 metadata:{}}),'maillage expert jamais sélectionnable');
mA.enabled=false;
assert.ok(!isBuildingPickProxy(mA),'maillage désactivé jamais sélectionné');
mA.enabled=true;
// Changement de LOD : nouvelle maquette activée, extrusion toujours masquée.
assert.ok(swap.activate(fixture.ref,flat([-.3,-.3,80.3,20.3])));
assert.ok(!mA.isVisible);
// Plusieurs-à-plusieurs : la partie couvre B seule. Tant que l'ensemble
// est actif, la partie est refusée (jamais deux silhouettes sur B).
assert.ok(swap.conflicts('PA00000002'));
assert.equal(swap.activate('PA00000002',flat([40,0,80,20])),false,
 'partie refusée tant que l\'ensemble occupe B');
swap.deactivate(fixture.ref);
assert.ok(mA.isVisible&&mB.isVisible,'ensemble retiré : A et B restituées');
assert.ok(swap.activate('PA00000002',flat([40,0,80,20])));
assert.ok(mA.isVisible,'A non concernée par la partie');
assert.ok(!mB.isVisible,'B masquée par la partie active');
assert.equal(swap.activate(fixture.ref,fixture.shape),false,
 'ensemble refusé tant que la partie occupe B');
swap.deactivate('PA00000002');
assert.ok(mB.isVisible,'retour arrière complet');
// Tuile rechargée APRÈS la maquette : extrusion masquée à sa création.
assert.ok(swap.activate(fixture.ref,fixture.shape));
swap.unregister(A,mA);
const mA2=mesh();
swap.register(A,mA2,rect(0,0,40,20));
assert.equal(mA2.isVisible,false);
// Tuile supplémentaire hors de la maquette : maquette rejetée, extrusions
// restituées avant le retrait du maillage expert.
const mB2=mesh();
swap.register(B,mB2,rect(300,0,340,20));
assert.deepEqual(rejected,[[fixture.ref,B]]);
assert.ok(!swap.isActive(fixture.ref));
assert.ok(mA2.isVisible&&mB.isVisible&&mB2.isVisible);

// --- D6 : hystérésis des niveaux de détail ---------------------------------
assert.equal(chooseTier(640),'high');assert.equal(chooseTier(660),'medium');
assert.equal(chooseTier(690,'high'),'high','pas de bascule entre 650 et 700 m');
assert.equal(chooseTier(710,'high'),'medium');
assert.equal(chooseTier(640,'medium'),'medium','pas de retour avant 600 m');
assert.equal(chooseTier(590,'medium'),'high');
assert.equal(chooseTier(1550,'medium'),'medium');assert.equal(chooseTier(1650,'medium'),'low');
assert.equal(chooseTier(1450,'low'),'low');assert.equal(chooseTier(1350,'low'),'medium');
assert.equal(chooseTier(2000,'high'),'low','grand saut : directement au bon niveau');

// --- D4 : partie certifiée, appartenance des sommets ----------------------
const building=rect(0,0,40,20);
const facadeStrip=footprintShape([[ring([[0,-.5],[40,-.5],[40,1],[0,1]])]]);
const facadeWall=[[0,0,0,40,0,0,40,18,0,0,18,0]];
const fit=partFits(facadeStrip,[building],facadeWall);
assert.ok(fit.ok&&fit.maxVertexOutsidePartM===0,'façade posée sur le bord accepté');
assert.ok(!partFits(facadeStrip,[building],[[0,0,3,40,0,3,40,18,3]]).ok,
 'sommets à 3 m de la bande déclarée : rejet');
assert.ok(partFits(facadeStrip,[building],[[0,0,3,40,0,3,40,18,3]]).maxVertexOutsidePartM>1.9);
const offBuilding=footprintShape([[ring([[0,-6],[40,-6],[40,-4],[0,-4]])]]);
assert.ok(!partFits(offBuilding,[building],[[0,0,-5,40,0,-5,40,18,-5]]).partInsideIgn,
 'bande déclarée hors de l\'emprise IGN : rejet');
const courtPart=footprintShape([[ring([[18,18],[22,18],[22,22],[18,22]])]]);
assert.ok(!partFits(courtPart,[court],[[19,0,20,21,0,20,21,9,20]]).partInsideIgn,
 'partie déclarée dans une cour fermée : rejet');

// --- D4 : autorisation par partie, sans lever le verrou du monument ------
const docs=new ArchitectureDossiers();
docs.byRef.set('PA00000001',{ref:'PA00000001',publicationAllowed:false,
 documents:[{id:'plan-a'},{id:'plan-b'}],measurements:[],uncertainty:[],
 certifiedParts:[{partId:'travee-1',sourceIds:['plan-a'],status:'measured-and-approved',
   geometryReport:'reports/travee-1.json'},
  {partId:'travee-sans-rapport',sourceIds:['plan-a'],status:'measured-and-approved'},
  {partId:'travee-2',sourceIds:['plan-a'],status:'draft'}]});
assert.equal(docs.canPublish('PA00000001',['plan-a']),false,'monument entier toujours verrouillé');
assert.ok(docs.canPublishPart('PA00000001','travee-1',['plan-a']),'partie certifiée publiable');
assert.ok(!docs.canPublishPart('PA00000001','travee-1',['plan-b']),'source non certifiée pour la partie');
assert.ok(!docs.canPublishPart('PA00000001','travee-2',['plan-a']),'partie en brouillon refusée');
assert.ok(!docs.canPublishPart('PA00000001','travee-3',['plan-a']),'partie inconnue refusée');
assert.ok(!docs.canPublishPart('PA00000001','travee-1',[]),'sans source : refus');
assert.ok(!docs.canPublishPart('PA00000001','travee-sans-rapport',['plan-a']),
 'partie sans rapport de validation exacte : refus');

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
