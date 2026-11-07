import assert from 'node:assert/strict';
import {
  collides, labelVisibility, STREET_LABEL_MAX_RADIUS,
  STREET_NAME_FONT_PX, STREET_LABEL_LIMIT
} from '../src/streetLabelRules.ts';
assert.equal(labelVisibility(1250,0),0);
assert.equal(labelVisibility(STREET_LABEL_MAX_RADIUS,0),0);
assert.equal(labelVisibility(300,700),0);
assert.ok(labelVisibility(250,10)>.5);
assert.ok(labelVisibility(650,10)>0 && labelVisibility(650,10)<.5);
assert.equal(STREET_NAME_FONT_PX,9);
assert.ok(STREET_LABEL_LIMIT<=28);
assert.ok(collides({left:0,right:40,top:0,bottom:10},
  [{left:20,right:60,top:7,bottom:17}]));
assert.equal(collides({left:0,right:10,top:0,bottom:10},
  [{left:40,right:50,top:30,bottom:40}]),false);
console.log('Étiquettes de rues : proximité, taille fixe et désencombrement validés.');
