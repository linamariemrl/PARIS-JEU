import assert from 'node:assert/strict';
import {stableFoundation} from '../src/reliefAnchors.ts';

const polygon=[{x:-20,z:0},{x:0,z:0},{x:20,z:0},{x:20,z:30},{x:-20,z:30}];
const cliff=(x)=>x>0?96:x<0?12:24;
const reference=stableFoundation(polygon,cliff);
assert.ok(Number.isFinite(reference));
assert.ok(reference<50,'Un sommet haut ne doit pas relever toute la toiture');
assert.equal(stableFoundation(polygon,()=>-12),-12);
assert.equal(stableFoundation([],()=>1000),0);
assert.equal(stableFoundation([{x:1,z:2},{x:3,z:2}],(x,z)=>x*2+z),6);
const withInvalid=[{x:0,z:0},{x:Number.NaN,z:4},{x:10,z:0}];
assert.equal(stableFoundation(withInvalid,()=>7),7);
console.log('Assises uniques toitures et ponts : vérifiées.');
