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
import {quadOnRoad,roadQuadCenter,roadTextAltitude,worldHeightForPixelSize} from '../src/streetLabelGeometry.ts';
for(const angle of [-112,0,30,68,90,138,180]){
  const anchor={x:231.25,z:-143.75,kind:'rue',angle};
  for(const zoomSize of [.32,.55,1.2,2.8]){
    const quad=quadOnRoad(anchor,zoomSize*8,zoomSize);
    const center=roadQuadCenter(quad);
    assert.ok(Math.abs(center.x-anchor.x)<1e-10);
    assert.ok(Math.abs(center.z-anchor.z)<1e-10);
    assert.equal(center.y,.215);
    const ax=quad[3]-quad[0],az=quad[5]-quad[2];
    assert.ok(Math.abs(ax/Math.hypot(ax,az)-Math.cos(angle*Math.PI/180))<1e-9);
    assert.ok(Math.abs(az/Math.hypot(ax,az)-Math.sin(angle*Math.PI/180))<1e-9);
  }
}
assert.equal(roadTextAltitude('pont'),2.29);
assert.equal(roadTextAltitude('passerelle'),2.29);
assert.equal(roadTextAltitude('rue'),.215);
assert.ok(worldHeightForPixelSize(700,.8,700)<=1.5);
assert.ok(worldHeightForPixelSize(10,.8,700)>=.32);
console.log('Noms de rues ancrés dans la géométrie 3D : centre invariant au zoom.');
