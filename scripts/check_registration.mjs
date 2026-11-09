// R02-D5 / R03-C : repère EPSG:2154 des maquettes. Fonctions pures.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {lonLatToL93,l93ToLonLat,projectWith,l93ToScene,sceneToL93,masterToScene,
 fitSimilarity,applySimilarity,residuals,checkRegistration} from '../src/registration.ts';
import {CENTER,project} from '../src/geo.ts';

// 1. Lambert-93 contre PROJ 9.8.1 (pyproj 3.8.0, EPSG:4326 -> EPSG:2154).
const proj=[[2.3537,48.8545,652577.1684,6861800.8561],[2.351,48.8566,652380.9772,6862035.9824],
 [3,46.5,700000,6600000],[2.2945,48.8584,648237.3015,6862271.6816],[-1.5536,47.2184,355577.8016,6689723.1029]];
for(const [lon,lat,e,n] of proj){
 const p=lonLatToL93([lon,lat]);
 assert.ok(Math.hypot(p.e-e,p.n-n)<.001,'écart PROJ > 1 mm en '+lon+','+lat);
 const back=l93ToLonLat(p);
 assert.ok(Math.abs(back[0]-lon)<1e-10&&Math.abs(back[1]-lat)<1e-10,'aller-retour');
}
// 2. Même projection de scène que src/geo.ts.
for(const q of [[2.3537,48.8545],[2.35,48.86],[2.2,48.9]]){
 const a=project(q),b=projectWith(CENTER,q);
 assert.ok(Math.abs(a.x-b.x)<1e-9&&Math.abs(a.z-b.z)<1e-9,'projectWith diverge de geo.project');
}
// 3. Déplacer CENTER ne change pas l'alignement maquette <-> IGN.
const t=JSON.parse(readFileSync(new URL('../public/data/4e/tiles/-1_0.json',import.meta.url)));
const ring=t.buildings.find(b=>b.id==='BATIMENT0000000245157267').polygons[0][0];
const frames=[{center:CENTER,displayReferenceAltitudeM:35},
 {center:[2.30,48.88],displayReferenceAltitudeM:35},{center:[2.41,48.83],displayReferenceAltitudeM:0}];
for(const f of frames){
 for(const ll of ring.slice(0,40)){
  const ign=projectWith(f.center,ll);
  const l=lonLatToL93(ll);
  const model=l93ToScene(l,40,f);
  assert.ok(Math.hypot(model.x-ign.x,model.z-ign.z)<.001,'sommet coïncident décalé (>1 mm)');
  assert.ok(Math.abs(model.y-(40-f.displayReferenceAltitudeM))<1e-9,'altitude');
  const back=sceneToL93(model.x,model.y,model.z,f);
  assert.ok(Math.hypot(back.e-l.e,back.n-l.n)<.001&&Math.abs(back.altitudeNGF-40)<1e-9,'aller-retour scène');
 }
}
// Un décalage de 1,50 m à l'est est conservé (déformation locale < 0,5 %).
for(const f of frames){
 const ll=ring[0],l=lonLatToL93(ll);
 const a=l93ToScene(l,0,f),b=l93ToScene({e:l.e+1.5,n:l.n},0,f);
 assert.ok(Math.abs(Math.hypot(b.x-a.x,b.z-a.z)-1.5)<.0075,'décalage relatif non conservé');
}
// Master relatif à une origine : mêmes points qu'en absolu.
const o=lonLatToL93(ring[0]);
const rel=masterToScene([0,0,0,10,5,2],[o.e,o.n,35],frames[0]);
const abs=l93ToScene({e:o.e+10,n:o.n+5},37,frames[0]);
assert.ok(Math.hypot(rel[3]-abs.x,rel[4]-abs.y,rel[5]-abs.z)<1e-6);

// 4. Calage de feuille : similitude par moindres carrés, contrôles indépendants.
const truth={scale:1.0004,rotation:.37,tx:652500,ty:6861900};
const pt=(id,u,v)=>({id,drawing:[u,v],l93:applySimilarity(truth,[u,v])});
const ties=[pt('a',0,0),pt('b',62.82,0),pt('c',31,-12)];
const fit=fitSimilarity(ties);
assert.ok(Math.abs(fit.scale-truth.scale)<1e-9&&Math.abs(fit.rotation-truth.rotation)<1e-9);
assert.ok(residuals(fit,[pt('k',10,-5)])[0].meters<1e-6,'contrôle exact');
const noisy={...pt('k',10,-5)};noisy.l93=[noisy.l93[0]+.12,noisy.l93[1]];
assert.ok(Math.abs(residuals(fit,[noisy])[0].meters-.12)<1e-6,'résidu restitué en mètres');
assert.equal(fitSimilarity([pt('a',0,0)]),null,'un seul point : pas de calage');
assert.equal(fitSimilarity([pt('a',1,1),pt('a2',1,1)]),null,'points confondus : pas de calage');

// 5. Fiches de calage.
const published=JSON.parse(readFileSync(new URL(
 '../public/data/metropole/architecture/registration/PA00086319.json',import.meta.url)));
assert.equal(published.status,'unregistered','aucun calage revendiqué');
assert.deepEqual(checkRegistration(published),[]);
const rms=Math.sqrt(residuals(fit,[noisy])[0].meters**2);
const good={schema:1,ref:'PA00000001',sourceId:'x',status:'registered',originL93:[652500,6861900,35],
 tiePoints:ties,controlPoints:[noisy],transform:fit,rmsControlMeters:rms};
assert.deepEqual(checkRegistration(good),[]);
assert.ok(checkRegistration({...good,rmsControlMeters:.001}).length,'erreur de contrôle maquillée');
assert.ok(checkRegistration({...good,controlPoints:[ties[0]]}).length,'contrôle non indépendant');
assert.ok(checkRegistration({...good,tiePoints:[ties[0]]}).length,'un seul point d\'appui');
assert.ok(checkRegistration({...published,originL93:[1,2,3]}).length,'non calée avec origine');
console.log('Repère EPSG:2154 : Lambert-93 conforme à PROJ (< 1 mm), alignement indépendant de CENTER, '+
 'calage par moindres carrés et fiche PA00086319 non calée vérifiés.');
