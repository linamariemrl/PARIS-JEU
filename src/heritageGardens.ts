import {Color3,Mesh,MeshBuilder,Scene,StandardMaterial,VertexData,Vector3} from '@babylonjs/core';
import earcut from 'earcut';
import {terrainHeight} from './terrain';
import {appendDraped} from './reliefSurface';

type GardenKind='grass'|'wood'|'flower'|'water';
type RecordShape=[GardenKind,number[][][]];
interface Gardens{
 schema:1;source:string;features:RecordShape[];
 paths:number[][][];trees:number[][];
}
interface Batch{positions:number[];indices:number[];}
const PALETTE:Record<GardenKind,[number,number,number]>={
 grass:[.72,.79,.68],wood:[.54,.67,.54],
 flower:[.71,.76,.62],water:[.64,.72,.77]
};
function material(scene:Scene,label:string,rgb:[number,number,number]){
 const m=new StandardMaterial(label,scene);
 m.diffuseColor=new Color3(...rgb);
 m.emissiveColor=new Color3(...rgb);
 m.specularColor=Color3.Black();m.backFaceCulling=false;
 m.disableLighting=true;m.freeze();
 return m;
}
function append(batch:Batch,rings:number[][][],offset:number):void{
 const flat:number[]=[],holes:number[]=[];
 for(const raw of rings){
  if(raw.length<4)continue;
  const closed=Math.hypot(raw[0][0]-raw[raw.length-1][0],
   raw[0][1]-raw[raw.length-1][1])<.015;
  const p=closed?raw.slice(0,-1):raw;
  if(p.length<3)continue;
  if(flat.length)holes.push(flat.length/2);
  for(const q of p){
   if(!Number.isFinite(q[0])||!Number.isFinite(q[1]))return;
   flat.push(q[0],q[1]);
  }
 }
 if(flat.length<6)return;
 const tris=earcut(flat,holes,2);
 if(!tris.length)return;
 // Réutiliser l'ancrage MNT et la triangulation des routes éprouvées.
 appendDraped(batch,flat,tris,terrainHeight,offset,75,3800);
}
function apply(scene:Scene,kind:GardenKind,b:Batch):Mesh|null{
 if(!b.indices.length)return null;
 const mesh=new Mesh('jardins-historiques-'+kind,scene);
 const geometry=new VertexData();
 geometry.positions=b.positions;geometry.indices=b.indices;
 geometry.normals=Array.from({length:b.positions.length/3},()=>[0,1,0]).flat();
 geometry.applyToMesh(mesh);
 mesh.material=material(scene,'jardins-sources-'+kind,PALETTE[kind]);
 mesh.isPickable=false;mesh.freezeWorldMatrix();
 return mesh;
}
function instance(matrices:number[],x:number,y:number,z:number,
 sx:number,sy:number,sz:number):void{
 matrices.push(sx,0,0,0,0,sy,0,0,0,0,sz,0,x,y,z,1);
}
/** Couches descriptives additionnelles des domaines du Sénat et du Louvre.
 * Aucune superficie de jardin ne devient automatiquement une pelouse ;
 * aucune allée n'est élargie arbitrairement en chaussée.
 * Tous les maillages sont permanents, indépendants de la distance au zoom.
 */
export class HeritageGardenLayer{
 private meshes:Mesh[]=[];
 constructor(private scene:Scene,private status:(message:string)=>void){}
 async init():Promise<void>{
  try{
   const response=await fetch(import.meta.env.BASE_URL+
     'data/metropole/places/garden-details.json');
   if(!response.ok){
    this.status('Jardins patrimoniaux : contours et sources institutionnelles disponibles');
    return;
   }
   const data=await response.json() as Gardens;
   if(data.schema!==1||!Array.isArray(data.features)||
     !Array.isArray(data.paths)||!Array.isArray(data.trees))
     throw Error('Inventaire des jardins invalide');
   const batches={} as Record<GardenKind,Batch>;
   for(const k of Object.keys(PALETTE) as GardenKind[])
    batches[k]={positions:[],indices:[]};
   let count=0;
   for(const [kind,rings] of data.features){
    if(!(kind in PALETTE)||!Array.isArray(rings))continue;
    append(batches[kind],rings,.62);
    if(++count%45===0)
     await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
   }
   for(const kind of Object.keys(PALETTE) as GardenKind[]){
    const mesh=apply(this.scene,kind,batches[kind]);
    if(mesh)this.meshes.push(mesh);
   }
   const paths=data.paths.filter(line=>line.length>=2).map(line=>
    line.map(p=>new Vector3(p[0],terrainHeight(p[0],p[1])+.85,p[1])));
   if(paths.length){
    const path=MeshBuilder.CreateLineSystem('allees-documentees-jardins',
     {lines:paths},this.scene);
    path.color=new Color3(.80,.74,.63);
    path.isPickable=false;
    this.meshes.push(path);
   }
   const trunks:number[]=[],crowns:number[]=[];
   let shown=0;
   for(const entry of data.trees){
    if(entry.length<2||!Number.isFinite(entry[0])||!Number.isFinite(entry[1]))
     continue;
    const [x,z,recordedHeight]=entry;
    const h=recordedHeight>=2&&recordedHeight<=40?recordedHeight:7;
    const y=terrainHeight(x,z);
    instance(trunks,x,y+h*.23,z,.22,h*.46,.22);
    instance(crowns,x,y+h*.70,z,Math.min(3,h*.30),h*.30,
      Math.min(3,h*.30));
    if(++shown>3500)break;
   }
   if(trunks.length){
    const trunk=MeshBuilder.CreateCylinder('arbres-osm-jardins-troncs',
     {height:1,diameter:1,tessellation:5},this.scene);
    trunk.material=material(this.scene,'troncs-jardins',[.40,.38,.32]);
    trunk.isPickable=false;
    trunk.thinInstanceSetBuffer('matrix',new Float32Array(trunks),16,true);
    trunk.thinInstanceRefreshBoundingInfo();
    this.meshes.push(trunk);
    const crown=MeshBuilder.CreateSphere('arbres-osm-jardins-houppiers',
     {diameter:2,segments:5},this.scene);
    crown.material=material(this.scene,'couronnes-jardins',[.39,.51,.39]);
    crown.isPickable=false;
    crown.thinInstanceSetBuffer('matrix',new Float32Array(crowns),16,true);
    crown.thinInstanceRefreshBoundingInfo();
    this.meshes.push(crown);
   }
   this.status('Domaines Sénat / Louvre : '+count+' surfaces réelles, '+
    paths.length+' axes d’allées, '+shown+
    ' arbres géolocalisés (formes schématiques si hauteur inconnue)');
  }catch(error){
   console.warn('Détails géographiques des jardins',error);
   this.status('Jardins : éléments additionnels indisponibles, socle officiel conservé');
  }
 }
}
