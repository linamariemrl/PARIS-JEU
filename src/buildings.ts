import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, VertexData, Vector3 } from '@babylonjs/core';
import {extrusionSwap} from './architectureModels';
import {heritageFootprints,boxOfPositions} from './heritageFootprints';
import earcut from 'earcut';
import { project } from './geo';
import {terrainHeight} from './terrain';
import {stableFoundation} from './reliefAnchors';
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
export type BuildingMaterials={wall:StandardMaterial;roof:StandardMaterial;heritageWall:StandardMaterial;heritageRoof:StandardMaterial;politicalWall:StandardMaterial;politicalRoof:StandardMaterial;culturalWall:StandardMaterial;culturalRoof:StandardMaterial;financialWall:StandardMaterial;financialRoof:StandardMaterial};

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
  // Le relief mesuré LiDAR doit primer sur un étagement municipal estimé.
  // On n'utilise les subdivisions qu'en l'absence d'une couverture LiDAR valide.
  const measured=b.lidarRoof&&
    b.lidarRoof.parts.length===b.polygons.length&&
    b.polygons.every((p,i)=>validLidarPart(b.lidarRoof!.parts[i],p))?
      b.lidarRoof:null;
  const detailed=!measured&&b.volumes&&shouldUseVolumes(
    b.volumes.coverage,b.volumes.parts.length,Boolean(b.roofInfo)
  )?b.volumes:null;
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
    // Une seule altitude d'assise pour la toiture de chaque corps bâti :
    // échantillonner le MNT à chacun des sommets du toit produisait des
    // triangles inclinés et de fausses flèches de plusieurs dizaines de m.
    const foundation=stableFoundation(rings[0],terrainHeight);
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
        // La base des murs reste au contact du terrain sur une pente,
        // alors que l'altitude des toitures reste cohérente et stable.
        const topP=foundation+ph,topQ=foundation+qh;
        const py=Math.min(terrainHeight(p.x,p.z),topP-.35);
        const qy=Math.min(terrainHeight(q.x,q.z),topQ-.35);
        const a:XYZ=[p.x,py,p.z],bb:XYZ=[q.x,qy,q.z];
        const c:XYZ=[q.x,topQ,q.z],d:XYZ=[p.x,topP,p.z];
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
        tri(roofs,[a[0],foundation+a[2],a[1]],
          [bb[0],foundation+bb[2],bb[1]],
          [c[0],foundation+c[2],c[1]],index);
      }
      continue;
    }
    const triangles=earcut(points.flatMap(p=>[p.x,p.z]),holes,2);
    for(let k=0;k<triangles.length;k+=3){
      const a=points[triangles[k]],b2=points[triangles[k+1]],c=points[triangles[k+2]];
      const top=(p:{x:number;z:number})=>
        profile?.heightAt(p)??section.height;
      const pa:XYZ=[a.x,foundation+top(a),a.z],
        pb:XYZ=[b2.x,foundation+top(b2),b2.z],
        pc:XYZ=[c.x,foundation+top(c),c.z];
      if(profile&&profile.rise>.05){
        const center={x:(a.x+b2.x+c.x)/3,z:(a.z+b2.z+c.z)/3};
        const pm:XYZ=[center.x,foundation+top(center),center.z];
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
  wall.diffuseColor=new Color3(.92,.91,.88);
  wall.specularColor=Color3.Black();
  wall.backFaceCulling=false;
  wall.freeze();
  const roof=new StandardMaterial('maquette-toits-gris-mat',scene);
  roof.diffuseColor=new Color3(.69,.72,.74);
  roof.specularColor=Color3.Black();
  roof.backFaceCulling=false;
  roof.freeze();
  const heritageWall=new StandardMaterial('monuments-beige-pierre',scene);
  heritageWall.diffuseColor=new Color3(.87,.80,.69);
  heritageWall.specularColor=Color3.Black();
  heritageWall.backFaceCulling=false;heritageWall.freeze();
  const heritageRoof=new StandardMaterial('monuments-beige-toits',scene);
  heritageRoof.diffuseColor=new Color3(.78,.71,.62);
  heritageRoof.specularColor=Color3.Black();
  heritageRoof.backFaceCulling=false;heritageRoof.freeze();
  const politicalWall=new StandardMaterial('institutions-orange-pierre',scene);
  politicalWall.diffuseColor=new Color3(.92,.78,.63);
  politicalWall.specularColor=Color3.Black();
  politicalWall.backFaceCulling=false;politicalWall.freeze();
  const politicalRoof=new StandardMaterial('institutions-orange-toit',scene);
  politicalRoof.diffuseColor=new Color3(.83,.69,.56);
  politicalRoof.specularColor=Color3.Black();
  politicalRoof.backFaceCulling=false;politicalRoof.freeze();
  const culturalWall=new StandardMaterial('culture-violet-clair',scene);
  culturalWall.diffuseColor=new Color3(.81,.76,.88);
  culturalWall.specularColor=Color3.Black();
  culturalWall.backFaceCulling=false;culturalWall.freeze();
  const culturalRoof=new StandardMaterial('culture-violet-toit',scene);
  culturalRoof.diffuseColor=new Color3(.73,.68,.81);
  culturalRoof.specularColor=Color3.Black();
  culturalRoof.backFaceCulling=false;culturalRoof.freeze();
  const financialWall=new StandardMaterial('finances-bleu-pierre',scene);
  financialWall.diffuseColor=new Color3(.70,.80,.89);
  financialWall.specularColor=Color3.Black();
  financialWall.backFaceCulling=false;financialWall.freeze();
  const financialRoof=new StandardMaterial('finances-bleu-toit',scene);
  financialRoof.diffuseColor=new Color3(.60,.72,.84);
  financialRoof.specularColor=Color3.Black();
  financialRoof.backFaceCulling=false;financialRoof.freeze();
  return {wall,roof,heritageWall,heritageRoof,
    politicalWall,politicalRoof,culturalWall,culturalRoof,financialWall,financialRoof};
}
function asMesh(scene:Scene,tile:TileFile,kind:'wall'|'roof',
                batch:Batch,mat:StandardMaterial,heritageIgnId?:string):Mesh|null{
  if(!batch.indices.length)return null;
  const vd=new VertexData();
  vd.positions=batch.positions;
  vd.indices=batch.indices;
  const normals:number[]=[];
  VertexData.ComputeNormals(batch.positions,batch.indices,normals);
  vd.normals=normals;
  const mesh=new Mesh('batiments-'+kind+'-'+tile.id+
    (heritageIgnId?'-'+heritageIgnId:''),scene);
  vd.applyToMesh(mesh);
  mesh.material=mat;
  mesh.isPickable=true;
  mesh.metadata={buildings:tile.buildings,faceToBuilding:batch.faceToBuilding,
    heritageIgnId};
  mesh.freezeWorldMatrix();
  if(heritageIgnId){
    // R02-D1/D2 : maillage propre, bascule par visibilité seulement.
    const box=boxOfPositions(batch.positions);
    if(box){
      extrusionSwap.register(heritageIgnId,mesh,box);
      mesh.onDisposeObservable.addOnce(()=>
        extrusionSwap.unregister(heritageIgnId,mesh));
    }
  }
  return mesh;
}
/** Lots fusionnés par matériau + un couple mur/toit propre à chaque
 * emprise IGN listée dans `heritage-footprints.json` (R02-D1). Ces
 * quelques draw calls supplémentaires évitent toute réécriture d'indices
 * lors du remplacement par une maquette experte. */
function tileBatches(materials:BuildingMaterials){
  const shared={walls:empty(),roofs:empty(),beigeWalls:empty(),beigeRoofs:empty(),
    orangeWalls:empty(),orangeRoofs:empty(),blueWalls:empty(),blueRoofs:empty(),
    violetWalls:empty(),violetRoofs:empty()};
  const separate=new Map<string,{walls:Batch;roofs:Batch;b:Building}>();
  const footprints=heritageFootprints();
  const choose=(b:Building):[Batch,Batch]=>{
    if(footprints.isTracked(b.id)){
      let own=separate.get(b.id);
      if(!own){own={walls:empty(),roofs:empty(),b};separate.set(b.id,own);}
      return [own.walls,own.roofs];
    }
    const s=shared;
    return b.heritageRole==='political'?[s.orangeWalls,s.orangeRoofs]:
      b.heritageRole==='cultural'?[s.violetWalls,s.violetRoofs]:
      b.heritageRole==='financial'?[s.blueWalls,s.blueRoofs]:
      b.heritageRef?[s.beigeWalls,s.beigeRoofs]:[s.walls,s.roofs];
  };
  const materialsOf=(b:Building):[StandardMaterial,StandardMaterial]=>
    b.heritageRole==='political'?[materials.politicalWall,materials.politicalRoof]:
    b.heritageRole==='cultural'?[materials.culturalWall,materials.culturalRoof]:
    b.heritageRole==='financial'?[materials.financialWall,materials.financialRoof]:
    b.heritageRef?[materials.heritageWall,materials.heritageRoof]:
    [materials.wall,materials.roof];
  const build=(scene:Scene,tile:TileFile):Mesh[]=>{
    const s=shared;
    const result:Mesh[]=[];
    for(const [kind,geometry,material] of [
      ['wall',s.walls,materials.wall],['roof',s.roofs,materials.roof],
      ['wall',s.beigeWalls,materials.heritageWall],
      ['roof',s.beigeRoofs,materials.heritageRoof],
      ['wall',s.orangeWalls,materials.politicalWall],
      ['roof',s.orangeRoofs,materials.politicalRoof],
      ['wall',s.violetWalls,materials.culturalWall],
      ['roof',s.violetRoofs,materials.culturalRoof],
      ['wall',s.blueWalls,materials.financialWall],
      ['roof',s.blueRoofs,materials.financialRoof]
    ] as const){
      const mesh=asMesh(scene,tile,kind,geometry,material);
      if(mesh)result.push(mesh);
    }
    for(const [id,own] of separate){
      const [wall,roof]=materialsOf(own.b);
      for(const mesh of [asMesh(scene,tile,'wall',own.walls,wall,id),
                         asMesh(scene,tile,'roof',own.roofs,roof,id)])
        if(mesh)result.push(mesh);
    }
    return result;
  };
  return {choose,build};
}
export function createTile(scene:Scene,tile:TileFile,materials:BuildingMaterials):Mesh[]{
  const {choose,build}=tileBatches(materials);
  tile.buildings.forEach((b,index)=>{
    const [w,r]=choose(b);
    addBuilding(w,r,b,index);
  });
  return build(scene,tile);
}

/** Prépare les géométries exactes sans bloquer le fil de rendu mobile.
 * Les sommets sont assemblés en tranches, mais un unique maillage par
 * matériau est construit à la fin : pas de milliers de draw calls.
 *
 * Le maillage précédent ou la silhouette lointaine reste visible durant
 * toute la préparation; le basculement n'intervient qu'après succès.
 */
export async function createTileProgressive(
  scene:Scene,tile:TileFile,materials:BuildingMaterials,
  stillWanted:()=>boolean=()=>true
):Promise<Mesh[]>{
  const {choose,build}=tileBatches(materials);
  const batch=100;
  for(let i=0;i<tile.buildings.length;i++){
    if(i>0&&i%batch===0){
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
      if(!stillWanted())return [];
    }
    const b=tile.buildings[i];
    const [w,r]=choose(b);
    addBuilding(w,r,b,i);
  }
  if(!stillWanted())return [];
  return build(scene,tile);
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
    const projectedRing=exterior.map(p=>b.localCoordinates?
      {x:p[0],z:p[1]}:project(p));
    const base=stableFoundation(projectedRing,terrainHeight);
    const points=projectedRing.map(p=>new Vector3(p.x,b.height+.12+base,p.z));
    if(Vector3.Distance(points[0],points[points.length-1])>.01)
      points.push(points[0].clone());
    const line=MeshBuilder.CreateLines('selection',{points},scene);
    line.color=new Color3(.18,.18,.18);
    line.isPickable=false;
    lines.push(line);
  }
  return lines;
}
