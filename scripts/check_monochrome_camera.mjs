import assert from 'node:assert/strict';
import {rotateWithFingers,wrapTwist,gestureApply,shortestYaw}
  from '../src/cameraGestures.ts';
assert.equal(gestureApply(0,100,true),35);
assert.ok(Math.abs(wrapTwist(2*Math.PI-.1)+.1)<1e-8);
assert.ok(Math.abs(shortestYaw(3.12,-3.12)-3.163185307179586)<.001);
assert.ok(rotateWithFingers(0,0,Math.PI/2)>1.5);
console.log('Gestes : orbitale 360°, précision et angles circulaires.');
