import {
  Color3,Mesh,Scene,StandardMaterial,VertexData
} from '@babylonjs/core';

interface GridMeta{
 schema:1;source:string;sourceUrl:string;
 measured:boolean;gridSpacingMeters:number;
 extent:{x:number;z:number;width:number;height:number};
 displayReferenceAltitudeM:number;validSamples:number;samples:number;
 minAltitudeM:number;maxAltitudeM:number;precision:string;
}

let current:TerrainGrid|null=null;
class TerrainGrid{
 readonly values:Int16Array;
 constructor(readonly meta:GridMeta,buffer:ArrayBuffer){
   this.values=new Int16Array(buffer);
 }
 get(x:number,z:number):number|null{
   const {extent,gridSpacingMeters:step}=this.meta;
   const tx=(x-extent.x)/step,tz=(z-extent.z)/step;
   if(tx<0||tz<0||tx>=extent.width-1||tz>=extent.height-1)return null;
   const ix=Math.floor(tx),iz=Math.floor(tz);
   const a=tx-ix,b=tz-iz;
   const w=extent.width;
   const p=[
     this.values[iz*w+ix],this.values[iz*w+ix+1],
     this.values[(iz+1)*w+ix],this.values[(iz+1)*w+ix+1]
   ];
   // Ne pas interpoler une altitude mesurée avec une cellule non documentée.
   if(p.some(v=>v===-32768))return null;
   return (p[0]*(1-a)*(1-b)+p[1]*a*(1-b)+
     p[2]*(1-a)*b+p[3]*a*b)*.1;
 }
}
/** Altitude relative au datum d'affichage, en mètres.
 * 0 uniquement lorsque la couche IGN n'est pas présente ou un point
 * n'est pas couvert : jamais présenté comme une altitude relevée.
 */
export function terrainHeight(x:number,z:number):number{
 return current?.get(x,z)??0;
}
export function terrainAltitude(x:number,z:number):number|null{
 const g=current;
 const v=g?.get(x,z);
 return g&&v!==null?v+g.meta.displayReferenceAltitudeM:null;
}
export function isTerrainReady(){return current!==null;}

function meshFromGrid(scene:Scene,g:TerrainGrid):Mesh|null{
 const {extent,gridSpacingMeters:step}=g.meta;
 const positions:number[]=[],indices:number[]=[];
 const columns=extent.width,rows=extent.height;
 for(let j=0;j<rows;j++){
   for(let i=0;i<columns;i++){
     const x=extent.x+i*step,z=extent.z+j*step;
     const h=g.values[j*columns+i];
     // Les rares valeurs sans source ne sont pas utilisées par les triangles.
     positions.push(x,h===-32768?0:h*.1,z);
   }
 }
 for(let j=0;j<rows-1;j++){
   for(let i=0;i<columns-1;i++){
     const a=j*columns+i,b=a+1,c=a+columns,d=c+1;
     if([a,b,c,d].some(k=>g.values[k]===-32768))continue;
     // Double triangle de terrain, aucun triangle pour une zone sans mesure.
     indices.push(a,c,b,b,c,d);
   }
 }
 if(!indices.length)return null;
 const mesh=new Mesh('terrain-RGE-ALTI-IGN',scene);
 const vd=new VertexData();
 vd.positions=positions;vd.indices=indices;
 const normals:number[]=[];
 VertexData.ComputeNormals(positions,indices,normals);
 vd.normals=normals;
 vd.applyToMesh(mesh);
 const mat=new StandardMaterial('relief-terrain-IGN-sans-texture',scene);
 mat.diffuseColor=new Color3(.85,.83,.79);
 mat.specularColor=Color3.Black();
 mat.backFaceCulling=false;
 mat.freeze();
 mesh.material=mat;
 mesh.isPickable=true;
 mesh.freezeWorldMatrix();
 return mesh;
}
/** Le terrain réel est chargé AVANT toute géométrie de bâtiment, surface
 * ou végétation. Les différentes couches partagent le même échantillonneur.
 * Si la source officielle échoue, le socle plat préexistant est conservé.
 */
export class TerrainModule{
 readonly name='Terrain RGE ALTI IGN';
 private mesh:Mesh|null=null;
 constructor(private scene:Scene,
  private onStatus:(message:string)=>void){}
 async init(flatFallback:Mesh):Promise<void>{
   try{
     const root=import.meta.env.BASE_URL+'data/metropole/terrain/';
     const [metaRes,dataRes]=await Promise.all([
       fetch(root+'manifest.json'),fetch(root+'elevation.bin')
     ]);
     if(!metaRes.ok||!dataRes.ok)throw Error('Grille IGN non publiée');
     const meta=await metaRes.json() as GridMeta;
     const data=await dataRes.arrayBuffer();
     if(meta.schema!==1||!meta.measured||
        meta.gridSpacingMeters!==200||
        !Number.isInteger(meta.samples)||meta.samples!==
          meta.extent.width*meta.extent.height||
        meta.validSamples<meta.samples*.96||
        meta.extent.width<70||meta.extent.height<70||
        data.byteLength!==meta.samples*2)
       throw Error('Mesures RGE ALTI invalides');
     const grid=new TerrainGrid(meta,data);
     const mesh=meshFromGrid(this.scene,grid);
     if(!mesh)throw Error('Aucun triangle altimétrique valide');
     this.mesh=mesh;
     current=grid;
     flatFallback.setEnabled(false);
     this.onStatus('Relief IGN chargé, pas de '+meta.gridSpacingMeters+
       ' m, altitudes '+meta.minAltitudeM+' à '+meta.maxAltitudeM+
       ' m : interpolation entre les points mesurés');
   }catch(error){
     console.warn('Relief IGN optionnel indisponible',error);
     current=null;
     flatFallback.setEnabled(true);
     this.onStatus('Relief mesuré non disponible : carte plane conservée');
   }
 }
}
