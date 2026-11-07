import assert from 'node:assert/strict';
import {corniceSegments,polygonArea} from '../src/corniceGeometry.ts';
const ring=[{x:0,z:0},{x:20,z:0},{x:20,z:10},{x:0,z:10}];
assert.equal(polygonArea(ring),200);
const items=corniceSegments(ring,22);
assert.equal(items.length,4);
for(const item of items){
 assert.ok(item.top<=22);
 assert.ok(item.bottom>=0);
 assert.ok(item.top>item.bottom);
 const len=Math.hypot(item.a.x-item.outA.x,item.a.z-item.outA.z);
 assert.ok(Math.abs(len-.14)<1e-8);
}
assert.equal(corniceSegments(ring,8).length,0);
assert.equal(corniceSegments(ring.slice(0,2),22).length,0);
assert.equal(corniceSegments([...ring].reverse(),22).length,4);
console.log('Couronnements : géométrie 3D limitée en hauteur, faible saillie et contrôle des emprises.');
