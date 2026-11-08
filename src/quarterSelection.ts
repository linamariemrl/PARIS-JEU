import {Color3,Mesh,Scene,StandardMaterial,VertexData} from '@babylonjs/core';
import earcut from 'earcut';
import {terrainHeight} from './terrain';
import {appendDraped} from './reliefSurface';
import type {QuarterRecord} from './urbanAtlas';

/** Teintes discrètes réservées au seul quartier sélectionné.
 * Le reste de la ville et de la palette blanc-gris ne change pas.
 */
const COLORS:ReadonlyArray<readonly [number,number,number]>=[
 [.54,.67,.74],[.64,.70,.57],[.72,.63,.71],[.76,.69,.55],
 [.55,.70,.69],[.66,.67,.77],[.76,.65,.62],[.67,.72,.65]
];
export function quarterColor(arr?:number):readonly [number,number,number]{
 return COLORS[((Number.isInteger(arr)&&arr!>=1?arr!-1:0)%COLORS.length)];
}
export function quarterAreaKm2(quarter:QuarterRecord):number{
 const area=(ring:number[][]):number=>{
  let sum=0;
  for(let i=0;i<ring.length;i++){
   const a=ring[i],b=ring[(i+1)%ring.length];
   sum+=a[0]*b[1]-b[0]*a[1];
  }
  return Math.abs(sum)/2;
 };
 const total=quarter.polygons.reduce((value,polygon)=>
  value+(polygon[0]?area(polygon[0]):0)-
   polygon.slice(1).reduce((a,ring)=>a+area(ring),0),0);
 return Math.max(0,total)/1_000_000;
}
/** Un seul maillage non cliquable à la fois, créé uniquement lors d'une
 * nouvelle sélection. Aucun calcul de géométrie dans la boucle de rendu.
 */
export class QuarterOverlay{
 private mesh:Mesh|null=null;
 private material:StandardMaterial|null=null;
 private current:QuarterRecord|null=null;
 constructor(private readonly scene:Scene){}
 clear():void{
  this.mesh?.dispose();this.mesh=null;
  this.material?.dispose();this.material=null;
  this.current=null;
 }
 show(quarter:QuarterRecord):void{
  if(this.current===quarter)return;
  this.clear();
  const batch={positions:[] as number[],indices:[] as number[]};
  for(const polygon of quarter.polygons){
   const flat:number[]=[],holes:number[]=[];
   for(const raw of polygon){
    if(!Array.isArray(raw)||raw.length<3)continue;
    const first=raw[0],last=raw[raw.length-1];
    const ring=Math.hypot(first[0]-last[0],first[1]-last[1])<.02?
      raw.slice(0,-1):raw;
    if(ring.length<3||ring.some(p=>!Number.isFinite(p[0])||
       !Number.isFinite(p[1])))continue;
    if(flat.length)holes.push(flat.length/2);
    for(const [x,z] of ring)flat.push(x,z);
   }
   if(flat.length<6)continue;
   const triangles=earcut(flat,holes,2);
   // Répartir les triangles au relief IGN, sans maillage permanent par
   // quartier ; 6 500 sommets au maximum par polygone.
   appendDraped(batch,flat,triangles,terrainHeight,1.05,140,6500);
  }
  if(!batch.indices.length)return;
  const mesh=new Mesh('quartier-selection-officielle',this.scene);
  const geometry=new VertexData();
  geometry.positions=batch.positions;geometry.indices=batch.indices;
  geometry.normals=Array.from({length:batch.positions.length},(_,i)=>
    i%3===1?1:0);
  geometry.applyToMesh(mesh);
  const mat=new StandardMaterial('couleur-quartier-selection',this.scene);
  const [r,g,b]=quarterColor(quarter.arr);
  mat.diffuseColor=new Color3(r,g,b);
  mat.emissiveColor=new Color3(r,g,b);
  mat.disableLighting=true;
  mat.specularColor=Color3.Black();
  mat.alpha=.18;
  mat.disableDepthWrite=true;
  mat.backFaceCulling=false;
  mat.zOffset=-2;
  mesh.material=mat;
  mesh.isPickable=false;
  mesh.freezeWorldMatrix();
  this.material=mat;this.mesh=mesh;this.current=quarter;
 }
}
