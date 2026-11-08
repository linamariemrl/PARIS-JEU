import assert from 'node:assert/strict';
import {refineSurface,appendDraped} from '../src/reliefSurface.ts';

const flat=[0,0,600,0,600,200,0,200,250,65,350,65,350,125,250,125];
const faces=[0,1,7,1,6,7,1,2,6,2,5,6,2,3,5,3,4,5];
// A simple shared-edge tiling of an elongated rectangle; 600 m edges
// must become contiguous on steep sloping terrain without holes.
const refined=refineSurface([0,0,600,0,600,200,0,200],[0,1,2,0,2,3],100,30000);
assert.ok(refined.subdivided);
assert.ok(refined.coordinates.length>8);
assert.ok(refined.indices.length>6);
const maxLength=(coordinates,indices)=>{
  let m=0;
  for(let i=0;i<indices.length;i+=3){
    for(const [a,b] of [[indices[i],indices[i+1]],
      [indices[i+1],indices[i+2]],[indices[i+2],indices[i]]]){
      const dx=coordinates[a*2]-coordinates[b*2];
      const dz=coordinates[a*2+1]-coordinates[b*2+1];
      m=Math.max(m,Math.hypot(dx,dz));
    }
  }
  return m;
};
assert.ok(maxLength(refined.coordinates,refined.indices)<=100.00001);
const edges=new Map();
let projectedArea=0;
for(let i=0;i<refined.indices.length;i+=3){
  const [a,b,c]=refined.indices.slice(i,i+3);
  const x=refined.coordinates;
  const tri=((x[b*2]-x[a*2])*(x[c*2+1]-x[a*2+1])-
      (x[c*2]-x[a*2])*(x[b*2+1]-x[a*2+1]))/2;
  assert.ok(tri>0,'Raffinement conserve l’ordre des triangles');
  projectedArea+=tri;
  for(const [u,v] of [[a,b],[b,c],[c,a]]){
    const k=[u,v].sort((p,q)=>p-q).join(':');
    edges.set(k,(edges.get(k)||0)+1);
  }
}
assert.equal(projectedArea,120000);
assert.ok([...edges.values()].every(n=>n<=2),'Pas de raccordement disjoint');
const flatRegion={positions:[],indices:[]};
appendDraped(flatRegion,[0,0,600,0,600,200,0,200],
  [0,1,2,0,2,3],(x,z)=>x/15+(z>100?15:0),0.45,100,30000);
assert.equal(flatRegion.positions.length/3,refined.coordinates.length/2);
assert.ok(flatRegion.positions.every(Number.isFinite));
const maxHeight=flatRegion.positions.filter((_,i)=>i%3===1);
assert.ok(Math.max(...maxHeight)-Math.min(...maxHeight)>40);
const limited=refineSurface([0,0,600,0,600,200,0,200],[0,1,2,0,2,3],100,4);
assert.ok(!limited.subdivided);
const hole=refineSurface([0,0,400,0,400,400,0,400,100,100,300,100,300,300,100,300],
 [0,1,5,0,5,4,1,2,6,1,6,5,2,3,7,2,7,6,3,0,4,3,4,7],65,30000);
const pointInHole=(x,z)=>x>100+1e-5&&x<300-1e-5&&z>100+1e-5&&z<300-1e-5;
for(let i=0;i<hole.indices.length;i+=3){
 const [a,b,c]=hole.indices.slice(i,i+3);
 const x=(hole.coordinates[2*a]+hole.coordinates[2*b]+hole.coordinates[2*c])/3;
 const z=(hole.coordinates[2*a+1]+hole.coordinates[2*b+1]+hole.coordinates[2*c+1])/3;
 assert.ok(!pointInHole(x,z),'Aucun nouveau triangle dans un trou');
}
console.log('Triangulation topologique conforme, budget et dénivelés : OK.');
