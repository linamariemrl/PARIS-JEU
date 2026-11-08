import {
 Color3,Mesh,Scene,StandardMaterial,VertexData
} from '@babylonjs/core';
import earcut from 'earcut';

/** Habillage surfacique SIG, sans bitmap ni relief inventé.
 * L'emprise d'un parc ne garantit PAS que chaque mètre carré est gazonné.
 * Seules les géométries officielles publiées sont affichées.
 */
export type SurfaceKind='managed'|'wood'|'planted'|'water'|'road';
type Polygon=number[][][];
interface Feature {kind:SurfaceKind;polygons:Polygon[];}
interface SurfaceFile{
 schema:1;source:string;sourceUrl:string;features:Feature[];
 count:number;note?:string;
}
interface Batch {positions:number[];normals:number[];indices:number[];count:number;}
const palette:Record<SurfaceKind,[number,number,number]>={
 managed:[.71,.77,.67], wood:[.51,.64,.51],
 planted:[.63,.73,.60], water:[.57,.69,.73],
 road:[.70,.69,.67]
};
const y:Record<SurfaceKind,number>={
 managed:.022,wood:.023,planted:.024,water:.030,road:.040
};
function empty():Batch{return {positions:[],normals:[],indices:[],count:0};}
function append(batch:Batch,poly:Polygon,kind:SurfaceKind){
 if(!Array.isArray(poly)||!poly.length)return;
 const flat:number[]=[],holes:number[]=[];
 for(let r=0;r<poly.length;r++){
  const raw=poly[r];if(!Array.isArray(raw)||raw.length<3)continue;
  let pts=raw;
  const first=raw[0],last=raw[raw.length-1];
  if(first&&last&&Math.hypot(first[0]-last[0],first[1]-last[1])<.01)
   pts=raw.slice(0,-1);
  if(pts.length<3)continue;
  if(flat.length)holes.push(flat.length/2);
  for(const p of pts){
   if(!Array.isArray(p)||!Number.isFinite(p[0])||!Number.isFinite(p[1]))
    return;
   flat.push(p[0],p[1]);
  }
 }
 if(flat.length<6)return;
 const triangulated=earcut(flat,holes,2);
 if(!triangulated.length)return;
 const offset=batch.positions.length/3;
 for(let i=0;i<flat.length;i+=2){
  batch.positions.push(flat[i],y[kind],flat[i+1]);
  batch.normals.push(0,1,0);
 }
 for(const index of triangulated)batch.indices.push(offset+index);
 batch.count++;
}
function commit(scene:Scene,batch:Batch,kind:SurfaceKind):void{
 if(!batch.indices.length)return;
 const mesh=new Mesh('surface-officielle-'+kind,scene);
 const vd=new VertexData();
 vd.positions=batch.positions;vd.indices=batch.indices;vd.normals=batch.normals;
 vd.applyToMesh(mesh);
 const mat=new StandardMaterial('surface-couleur-mate-'+kind,scene);
 mat.diffuseColor=new Color3(...palette[kind]);
 mat.specularColor=Color3.Black();
 mat.disableLighting=true;
 // Décalage de profondeur GPU : empêche les polygones plats de scintiller
 // contre le grand sol lors des zooms ou des orientations de caméra.
 // La géométrie reste à la hauteur SIG du rendu.
 mat.zOffset=-1;
 mat.backFaceCulling=false;
 mat.freeze();
 mesh.material=mat;mesh.isPickable=false;
 mesh.freezeWorldMatrix();
}
function fileValid(data:SurfaceFile):boolean{
 return data.schema===1&&Array.isArray(data.features)&&data.count===data.features.length&&
  data.count>=1&&data.count<30000&&typeof data.sourceUrl==='string';
}
/** Les couches sont construites après chargement, par tranches pour laisser
 * les gestes Android fonctionner même avec un grand parc polygonal.
 */
export async function installSurfaceLayer(
 scene:Scene,path:string,onStatus:(text:string)=>void
):Promise<void>{
 try{
  const result=await fetch(import.meta.env.BASE_URL+path);
  if(!result.ok){onStatus('Couche non publiée : '+path.split('/').pop());return;}
  const data=await result.json() as SurfaceFile;
  if(!fileValid(data))throw Error('Données de surfaces invalides');
  const batches:Record<SurfaceKind,Batch>={
   managed:empty(),wood:empty(),planted:empty(),water:empty(),road:empty()
  };
  let processed=0;
  for(const item of data.features){
   if(!Object.prototype.hasOwnProperty.call(batches,item.kind)||
      !Array.isArray(item.polygons))continue;
   for(const poly of item.polygons)append(batches[item.kind],poly,item.kind);
   if(++processed%35===0)
    await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
  }
  let count=0;
  for(const kind of ['managed','wood','planted','water','road'] as SurfaceKind[]){
   commit(scene,batches[kind],kind);count+=batches[kind].count;
  }
  onStatus(count.toLocaleString('fr-FR')+
   ' emprises vectorielles ('+data.source+' ; pas de texture)');
 }catch(error){
  console.warn('Couche surfacique',path,error);
  onStatus('Surfaces réelles indisponibles ; sol neutre conservé');
 }
}
