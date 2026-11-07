import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, VertexData, Vector3 } from '@babylonjs/core';
import earcut from 'earcut';
import { createFacadeTextures, type FacadeCategory, type SurfaceCategory } from './facadeTexture';
import { WALL_SURFACES, ROOF_SURFACES, surfaceForCode } from './materialCatalog';
import { project } from './geo';
import type { Building, Point, TileFile } from './types';

type XYZ = [number, number, number];
type RGB = [number, number, number];
type UV = [number, number];
interface Batch {
  positions: number[];
  indices: number[];
  colors: number[];
  uvs: number[];
  faceToBuilding: number[];
}
export type BuildingMaterials = Record<SurfaceCategory, StandardMaterial>;
const TYPES: SurfaceCategory[] = [
  'residential','commercial','religious','neutral','roof',
  ...WALL_SURFACES,...ROOF_SURFACES
];
const WALLS: RGB[] = [
  [0.98,0.95,0.91],[1.0,0.98,0.94],[0.95,0.95,0.91],
  [0.91,0.91,0.87],[0.99,0.96,0.92],[0.96,0.93,0.90]
];
const ROOF: RGB = [0.95, 0.95, 0.95];
const empty=():Batch=>({positions:[],indices:[],colors:[],uvs:[],faceToBuilding:[]});

function tri(out: Batch,a:XYZ,b:XYZ,c:XYZ,rgb:RGB,id:number,
             uv:[UV,UV,UV]) {
  const start=out.positions.length/3;
  out.positions.push(...a,...b,...c);
  out.indices.push(start,start+1,start+2);
  for (let i=0;i<3;i++) {
    out.colors.push(...rgb,1);
    out.uvs.push(...uv[i]);
  }
  out.faceToBuilding.push(id);
}
function hash(str:string) {
  let value=2166136261;
  for(const char of str)value=Math.imul(value ^ char.charCodeAt(0),16777619);
  return value>>>0;
}
function projected(ring:Point[]) {
  const pts=ring.map(project);
  if(pts.length>2 && Math.hypot(pts[0].x-pts[pts.length-1].x,
                               pts[0].z-pts[pts.length-1].z)<0.01)pts.pop();
  return pts;
}
/** Usage connu par IGN. Le matériau exact et la période ne sont PAS déduits. */
export function facadeCategory(building:Building): FacadeCategory {
  const usage=building.usage.toLowerCase();
  if (/relig|culte|église|eglise|cathédr|cathedr/.test(usage)) return 'religious';
  if (/commercial|service|bureau|industri|artisan/.test(usage)) return 'commercial';
  if (/résident|resident|habitation|logement/.test(usage)) return 'residential';
  return 'neutral';
}
function addBuilding(walls:Batch,roofs:Batch,b:Building,index:number) {
  const height=Math.min(220,Math.max(2,b.height));
  const wallColor=WALLS[hash(b.id)%WALLS.length];
  for (const polygon of b.polygons) {
    const rings=polygon.map(projected).filter(x=>x.length>=3);
    if (!rings.length)continue;
    const points:{x:number;z:number}[]=[];
    const holes:number[]=[];
    for(let r=0;r<rings.length;r++) {
      if(r>0) holes.push(points.length);
      points.push(...rings[r]);
    }
    // Toutes les emprises et les cours intérieures sont conservées.
    for(const ring of rings) {
      for(let j=0;j<ring.length;j++) {
        const p=ring[j],q=ring[(j+1)%ring.length];
        const a:XYZ=[p.x,0,p.z], bb:XYZ=[q.x,0,q.z];
        const c:XYZ=[q.x,height,q.z],d:XYZ=[p.x,height,p.z];
        const u=Math.hypot(q.x-p.x,q.z-p.z)/6;
        const v=height/3.0;
        const uv0:UV=[0,0],uv1:UV=[u,0],uv2:UV=[u,v],uv3:UV=[0,v];
        tri(walls,a,bb,c,wallColor,index,[uv0,uv1,uv2]);
        tri(walls,a,c,d,wallColor,index,[uv0,uv2,uv3]);
      }
    }
    const flat=points.flatMap(p=>[p.x,p.z]);
    const t=earcut(flat,holes,2);
    for(let k=0;k<t.length;k+=3) {
      const a=points[t[k]],bb=points[t[k+1]],c=points[t[k+2]];
      // Les toits restent à l'altitude IGN ; leur pente n'est pas inventée.
      tri(roofs,[a.x,height,a.z],[bb.x,height,bb.z],[c.x,height,c.z],
          ROOF,index,
          [[a.x/3,a.z/3],[bb.x/3,bb.z/3],[c.x/3,c.z/3]]);
    }
  }
}
export function createMaterials(scene:Scene): BuildingMaterials {
  const textures=createFacadeTextures(scene);
  const result={} as BuildingMaterials;
  for (const type of TYPES) {
    const mat=new StandardMaterial('revetement-'+type,scene);
    mat.diffuseTexture=textures[type];
    mat.diffuseColor=Color3.White();
    mat.specularColor=type==='roof'?new Color3(.13,.14,.16):new Color3(.02,.02,.02);
    mat.backFaceCulling=false;
    result[type]=mat;
  }
  return result;
}
function asMesh(scene:Scene,tile:TileFile,kind:SurfaceCategory,
                batch:Batch,mat:StandardMaterial):Mesh|null {
  if(!batch.indices.length)return null;
  const vd=new VertexData();
  vd.positions=batch.positions;vd.indices=batch.indices;
  vd.colors=batch.colors;vd.uvs=batch.uvs;
  const normals:number[]=[];
  VertexData.ComputeNormals(batch.positions,batch.indices,normals);
  vd.normals=normals;
  const mesh=new Mesh('batiments-'+kind+'-'+tile.id,scene);
  vd.applyToMesh(mesh);
  mesh.material=mat;mesh.useVertexColors=true;
  mesh.isPickable=true;
  mesh.metadata={buildings:tile.buildings,faceToBuilding:batch.faceToBuilding};
  mesh.freezeWorldMatrix();
  return mesh;
}
export function createTile(scene:Scene,tile:TileFile,
                           materials:BuildingMaterials):Mesh[] {
  const batches={} as Record<SurfaceCategory,Batch>;
  for(const type of TYPES)batches[type]=empty();
  tile.buildings.forEach((building,index)=>{
    const wallKind=surfaceForCode(building.wallCode,false)??facadeCategory(building);
    const roofKind=surfaceForCode(building.roofCode,true)??'roof';
    addBuilding(batches[wallKind],batches[roofKind],building,index);
  });
  const meshes:Mesh[]=[];
  for (const kind of TYPES) {
    const mesh=asMesh(scene,tile,kind,batches[kind],materials[kind]);
    if(mesh)meshes.push(mesh);
  }
  return meshes;
}
export function getPickedBuilding(mesh:Mesh,faceId:number):Building|null {
  const data=mesh.metadata as {buildings?:Building[];faceToBuilding?:number[]} | undefined;
  const id=data?.faceToBuilding?.[faceId];
  return id===undefined?null:data?.buildings?.[id]??null;
}
export function highlightBuilding(scene:Scene,b:Building):Mesh[] {
  const result:Mesh[]=[];
  for(const polygon of b.polygons) {
    const exterior=polygon[0];
    if(!exterior || exterior.length<3)continue;
    const pts=exterior.map(project).map(p=>new Vector3(p.x,b.height+0.12,p.z));
    if(Vector3.Distance(pts[0],pts[pts.length-1])>0.01)pts.push(pts[0].clone());
    const line=MeshBuilder.CreateLines('selection',{points:pts},scene);
    line.color=new Color3(1,.69,.2);line.isPickable=false;
    result.push(line);
  }
  return result;
}
