import {Color3,Mesh,Scene,StandardMaterial,VertexData} from '@babylonjs/core';
import earcut from 'earcut';

type Ring=number[][];
type Polygon=Ring[];
interface SurfaceFeature{kind:'water';polygons:Polygon[];}
interface WaterSource{
  schema:number;count:number;source:string;sourceUrl:string;
  features:SurfaceFeature[];
}
/** Couche de récupération limitée à l'eau IGN (environ 170 Ko).
 * À la différence du moteur de revêtements 0.19, aucun polygone de rue
 * ni maillage de terrain ne se superpose à la scène stable.
 */
export class StableWaterLayer{
  private polygons:Polygon[]=[];
  private ready=false;
  constructor(private scene:Scene,private onStatus:(message:string)=>void){}
  async init():Promise<void>{
    try{
      const response=await fetch(import.meta.env.BASE_URL+
        'data/metropole/surfaces/water.json');
      if(!response.ok)throw Error('Hydrographie IGN non disponible');
      const data=await response.json() as WaterSource;
      if(data.schema!==1||data.count!==data.features?.length||
        data.count<50||data.count>2000||
        !data.source.startsWith('IGN'))
        throw Error('Fichier hydrographique invalide');
      const positions:number[]=[],indices:number[]=[],normals:number[]=[];
      let processed=0;
      for(const item of data.features){
        if(item.kind!=='water'||!Array.isArray(item.polygons))continue;
        for(const polygon of item.polygons){
          const coords:number[]=[],holes:number[]=[];
          for(const ring of polygon){
            if(!Array.isArray(ring)||ring.length<4)continue;
            const last=ring[ring.length-1],first=ring[0];
            const closed=Math.hypot(first[0]-last[0],first[1]-last[1])<.02;
            const pts=closed?ring.slice(0,-1):ring;
            if(pts.length<3)continue;
            if(coords.length)holes.push(coords.length/2);
            for(const p of pts){
              if(!Number.isFinite(p[0])||!Number.isFinite(p[1])||
                Math.abs(p[0])>25000||Math.abs(p[1])>25000)
                throw Error('Coordonnées hydrographiques hors emprise');
              coords.push(p[0],p[1]);
            }
          }
          if(coords.length<6)continue;
          const faces=earcut(coords,holes,2);
          if(!faces.length)continue;
          const base=positions.length/3;
          for(let i=0;i<coords.length;i+=2){
            positions.push(coords[i],.065,coords[i+1]);
            normals.push(0,1,0);
          }
          for(const face of faces)indices.push(base+face);
          this.polygons.push(polygon);
        }
        if(++processed%24===0)
          await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
      }
      if(indices.length<300||indices.length>1_500_000)
        throw Error('Maillage hydrographique incomplet ou trop lourd');
      const mesh=new Mesh('eau-IGN-reelle-maquette-stable',this.scene);
      const vertex=new VertexData();
      vertex.positions=positions;
      vertex.indices=indices;
      vertex.normals=normals;
      vertex.applyToMesh(mesh);
      const mat=new StandardMaterial('eau-bleu-gris-stable',this.scene);
      mat.diffuseColor=new Color3(.54,.66,.71);
      mat.specularColor=Color3.Black();
      mat.disableLighting=true;
      mat.backFaceCulling=false;
      mat.freeze();
      mesh.material=mat;
      mesh.isPickable=false;
      mesh.freezeWorldMatrix();
      this.ready=true;
      this.onStatus(data.count.toLocaleString('fr-FR')+
        ' emprises d’eau IGN : géométrie réelle, un seul maillage');
    }catch(error){
      console.warn('Hydrographie IGN en mode stable',error);
      this.onStatus('Eau IGN : repli sur la voirie du 4e');
    }
  }
  identify(x:number,z:number):
    {kind:'water';label:string;source:string}|null{
    if(!this.ready)return null;
    const inside=(ring:Ring):boolean=>{
      let found=false;
      for(let i=0,j=ring.length-1;i<ring.length;j=i++){
        const a=ring[i],b=ring[j];
        if(!a||!b)continue;
        if((a[1]>z)!==(b[1]>z)){
          const px=(b[0]-a[0])*(z-a[1])/(b[1]-a[1])+a[0];
          if(x<px)found=!found;
        }
      }
      return found;
    };
    for(const polygon of this.polygons){
      if(polygon[0]&&inside(polygon[0])&&
         !polygon.slice(1).some(inside))
        return {kind:'water',label:'Surface d’eau réelle',
          source:'IGN BD TOPO, emprises hydrographiques'};
    }
    return null;
  }
}
