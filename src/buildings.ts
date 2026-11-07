import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, VertexData, Vector3 } from '@babylonjs/core';
import earcut from 'earcut';
import { project } from './geo';
import { roofProfile } from './roofGeometry';
import { steppedHeight, shouldUseVolumes } from './volumeGeometry';
import type { Building, Point, TileFile, LidarRoofPart } from './types';

type XYZ=[number,number,number];
interface Batch {
  positions:number[];
  indices:number[];
  faceToBuilding:number[];
}
const empty=():Batch=>({positions:[],indices:[],faceToBuilding:[]});
export type BuildingMaterials={wall:StandardMaterial;roof:StandardMaterial};

function tri(out:Batch,a:XYZ,b:XYZ,c:XYZ,id:number){
  const start=out.positions.length/3;
  out.positions.push(...a,...b,...c);
  out.indices.push(start,start+1,start+2);
  out.faceToBuilding.push(id);
}
function projected(ring:Point[],localCoordinates=false){
  const pts=localCoordinates?
    ring.map(([x,z])=>({x,z})):ring.map(project);
  if(pts.length>2&&Math.hypot(pts[0].x-pts[pts.length-1].x,
      pts[0].z-pts[pts.length-1].z)<.01)pts.pop();
  return pts;
}
/** La catégorie est un indice d'usage, jamais une preuve de style. */
export function facadeCategory(building:Building):
    'residential'|'commercial'|'religious'|'neutral'{
  const usage=building.usage.toLowerCase();
  if(/relig|culte|église|eglise|cathédr|cathedr/.test(usage))return 'religious';
  if(/commercial|service|bureau|industri|artisan/.test(usage))return 'commercial';
  if(/résident|resident|habitation|logement/.test(usage))return 'residential';
  return 'neutral';
}
function validLidarPart(part:LidarRoofPart|undefined,rings:Point[][]):boolean{
  if(!part||part.vertices.length<3||part.indices.length<3||
      part.indices.length%3!==0||part.ringsHeights.length!==rings.length)
    return false;
  if(part.ringsHeights.some((h,i)=>{
    const length=rings[i].length;
    const a=rings[i][0],last=rings[i][length-1];
    const closed=length>2&&Math.hypot(a[0]-last[0],a[1]-last[1])<.01;
    return h.length!==(closed?length-1:length)||
      h.some(v=>!Number.isFinite(v)||v<1||v>220);
  }))return false;
  return part.vertices.every(v=>v.length===3&&v.every(Number.isFinite))&&
    part.indices.every(i=>Number.isInteger(i)&&i>=0&&i<part.vertices.length);
}
function addBuilding(walls:Batch,roofs:Batch,b:Building,index:number){
  const height=Math.min(220,Math.max(2,b.height));
  const detailed=b.volumes&&shouldUseVolumes(
    b.volumes.coverage,b.volumes.parts.length,Boolean(b.roofInfo)
  )?b.volumes:null;
  const measured=(!detailed&&b.lidarRoof&&
    b.lidarRoof.parts.length===b.polygons.length&&
    b.polygons.every((p,i)=>validLidarPart(b.lidarRoof!.parts[i],p)))?
      b.lidarRoof:null;
  const sections=detailed
    ?detailed.parts.flatMap(v=>v.polygons.map(p=>({
        rings:p.map(r=>r.map(([x,z])=>({x,z}))),
        height:steppedHeight(height,v.floors,detailed.maxFloors),
        hasDocumentedRoof:false,
        lidar:undefined as LidarRoofPart|undefined
      })))
    :b.polygons.map((p,i)=>({
        rings:p.map(r=>projected(r,b.localCoordinates)),
        height,hasDocumentedRoof:true,
        lidar:measured?.parts[i] as LidarRoofPart|undefined
      }));
  for(const section of sections){
    const rings=section.rings.filter(x=>x.length>=3);
    if(!rings.length)continue;
    const profile=section.hasDocumentedRoof&&!section.lidar?
      roofProfile(b.roofInfo,height,rings[0]):null;
    const lidar=section.lidar;
    const points:{x:number;z:number}[]=[];
    const holes:number[]=[];
    for(let r=0;r<rings.length;r++){
      if(r>0)holes.push(points.length);
      points.push(...rings[r]);
    }
    for(let r=0;r<rings.length;r++){
      const ring=rings[r];
      const measuredHeights=lidar?.ringsHeights[r];
      for(let j=0;j<ring.length;j++){
        const p=ring[j],q=ring[(j+1)%ring.length];
        const ph=measuredHeights?.[j]??profile?.heightAt(p)??section.height;
        const qh=measuredHeights?.[(j+1)%ring.length]??profile?.heightAt(q)??section.height;
        const a:XYZ=[p.x,0,p.z],bb:XYZ=[q.x,0,q.z];
        const c:XYZ=[q.x,qh,q.z],d:XYZ=[p.x,ph,p.z];
        tri(walls,a,bb,c,index);
        tri(walls,a,c,d,index);
      }
    }
    if(lidar){
      // Maillage de couverture uniquement mesuré dans le MNH; aucune
      // extrapolation depuis les matériaux ou le style architectural.
      for(let k=0;k<lidar.indices.length;k+=3){
        const a=lidar.vertices[lidar.indices[k]];
        const bb=lidar.vertices[lidar.indices[k+1]];
        const c=lidar.vertices[lidar.indices[k+2]];
        tri(roofs,[a[0],a[2],a[1]],[bb[0],bb[2],bb[1]],
          [c[0],c[2],c[1]],index);
      }
      continue;
    }
    const triangles=earcut(points.flatMap(p=>[p.x,p.z]),holes,2);
    for(let k=0;k<triangles.length;k+=3){
      const a=points[triangles[k]],b2=points[triangles[k+1]],c=points[triangles[k+2]];
      const top=(p:{x:number;z:number})=>
        profile?.heightAt(p)??section.height;
      const pa:XYZ=[a.x,top(a),a.z],pb:XYZ=[b2.x,top(b2),b2.z],pc:XYZ=[c.x,top(c),c.z];
      if(profile&&profile.rise>.05){
        const center={x:(a.x+b2.x+c.x)/3,z:(a.z+b2.z+c.z)/3};
        const pm:XYZ=[center.x,top(center),center.z];
        tri(roofs,pa,pb,pm,index);
        tri(roofs,pb,pc,pm,index);
        tri(roofs,pc,pa,pm,index);
      }else tri(roofs,pa,pb,pc,index);
    }
  }
}

export function createMaterials(scene:Scene):BuildingMaterials{
  // Deux matériaux en tout pour les immeubles du 4e. Aucun atlas,
  // photographie, façade dessinée ni teinte selon les matériaux fiscaux.
  const wall=new StandardMaterial('maquette-murs-blanc-mat',scene);
  wall.diffuseColor=new Color3(.965,.965,.965);
  wall.specularColor=Color3.Black();
  wall.backFaceCulling=false;
  wall.freeze();
  const roof=new StandardMaterial('maquette-toits-gris-mat',scene);
  roof.diffuseColor=new Color3(.82,.82,.82);
  roof.specularColor=Color3.Black();
  roof.backFaceCulling=false;
  roof.freeze();
  return {wall,roof};
}
function asMesh(scene:Scene,tile:TileFile,kind:'wall'|'roof',
                batch:Batch,mat:StandardMaterial):Mesh|null{
  if(!batch.indices.length)return null;
  const vd=new VertexData();
  vd.positions=batch.positions;
  vd.indices=batch.indices;
  const normals:number[]=[];
  VertexData.ComputeNormals(batch.positions,batch.indices,normals);
  vd.normals=normals;
  const mesh=new Mesh('batiments-'+kind+'-'+tile.id,scene);
  vd.applyToMesh(mesh);
  mesh.material=mat;
  mesh.isPickable=true;
  mesh.metadata={buildings:tile.buildings,faceToBuilding:batch.faceToBuilding};
  mesh.freezeWorldMatrix();
  return mesh;
}
export function createTile(scene:Scene,tile:TileFile,materials:BuildingMaterials):Mesh[]{
  const walls=empty(),roofs=empty();
  tile.buildings.forEach((b,index)=>addBuilding(walls,roofs,b,index));
  const result:Mesh[]=[];
  const w=asMesh(scene,tile,'wall',walls,materials.wall);
  const r=asMesh(scene,tile,'roof',roofs,materials.roof);
  if(w)result.push(w);
  if(r)result.push(r);
  return result;
}
export function getPickedBuilding(mesh:Mesh,faceId:number):Building|null{
  const m=mesh.metadata as {buildings?:Building[];faceToBuilding?:number[]}|undefined;
  const index=m?.faceToBuilding?.[faceId];
  return index===undefined?null:m?.buildings?.[index]??null;
}
export function highlightBuilding(scene:Scene,b:Building):Mesh[]{
  const lines:Mesh[]=[];
  for(const polygon of b.polygons){
    const exterior=polygon[0];if(!exterior||exterior.length<3)continue;
    const points=exterior.map(p=>b.localCoordinates?
      {x:p[0],z:p[1]}:project(p)).map(p=>new Vector3(p.x,b.height+.12,p.z));
    if(Vector3.Distance(points[0],points[points.length-1])>.01)
      points.push(points[0].clone());
    const line=MeshBuilder.CreateLines('selection',{points},scene);
    line.color=new Color3(.18,.18,.18);
    line.isPickable=false;
    lines.push(line);
  }
  return lines;
}
