import assert from 'node:assert/strict';
import {wrapTwist,rotateWithFingers,tiltWithFingers,zoomAroundPinch,gestureRatio,gestureApply}
  from '../src/cameraGestures.ts';
assert.ok(Math.abs(wrapTwist(-6.2)-.083185307179586)<1e-10);
assert.ok(rotateWithFingers(0,0,.3)>.29);
assert.ok(rotateWithFingers(0,.3,0)<-.29);
assert.ok(tiltWithFingers(.8,-80)>.8);
assert.ok(tiltWithFingers(.8,80)<.8);
assert.ok(zoomAroundPinch(700,100,130)<700);
assert.ok(zoomAroundPinch(700,130,100)>700);
assert.equal(gestureRatio(false),1);
assert.equal(gestureRatio(true),.35);
assert.equal(gestureApply(0,100,true),35);
assert.equal(gestureApply(1,.76,true),.916);
assert.equal(gestureApply(0,-100,true),-35);
assert.equal(gestureApply(0,100,false),100);
console.log('Gestes Android : rotation inversée corrigée, inclinaison intuitive, pincement.');
