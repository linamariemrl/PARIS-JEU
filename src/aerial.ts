import {
  Color3, Mesh, Scene, StandardMaterial, Texture, VertexData
} from '@babylonjs/core';

interface Tile {id:string;ix:number;iz:number;file:string;bytes:number;}
interface Overview {file:string;bounds:[number,number,number,number];bytes:number;}
interface OrthophotoManifest {
  schema:number;
  source:string;
  license:string;
  tileMeters:number;
  tiles:Tile[];
  overview:Overview;
}
type Quality='low'|'medium'|'high';

/** Photographies aériennes authentiques de la BD ORTHO IGN.
 * Une grande vue de fond permanente, puis chargement local des carrés détaillés.
 * Aucun appel de l'Android aux serveurs de l'IGN : les images sont préparées
 * gratuitement par GitHub Actions, contrôlées et hébergées sur GitHub Pages.
 */
export class AerialLayer {
  private data:OrthophotoManifest|null=null;
  private active=new Map<string,Mesh>();
  private quality:Quality='medium';
  private lastX=Number.POSITIVE_INFINITY;
  private lastZ=Number.POSITIVE_INFINITY;
  constructor(private scene:Scene){}

  async init():Promise<boolean>{
    const base=import.meta.env.BASE_URL+'data/4e/aerial/';
    const res=await fetch(base+'manifest.json');
    if(!res.ok)return false;
    const data=await res.json() as OrthophotoManifest;
    if(data.schema!==1||data.tileMeters!==300||
       !Array.isArray(data.tiles)||data.tiles.length<25||
       !Array.isArray(data.overview?.bounds))return false;
    this.data=data;
    this.makePlane('orthophoto-generale',data.overview.bounds,
      base+data.overview.file,.025);
    this.update(0,0,true);
    const status=document.getElementById('aerial-status');
    if(status)status.textContent=
      data.tiles.length.toLocaleString('fr-FR')+' dalles BD ORTHO IGN gratuites';
    return true;
  }

  setQuality(level:Quality){
    this.quality=level;
    this.lastX=Infinity;
    this.update(0,0,true);
  }

  update(x:number,z:number,force=false){
    if(!this.data)return;
    if(!force&&Math.hypot(x-this.lastX,z-this.lastZ)<65)return;
    this.lastX=x;this.lastZ=z;
    const meters=this.data.tileMeters;
    const radius=this.quality==='low'?650:this.quality==='medium'?850:1100;
    const cap=this.quality==='low'?10:this.quality==='medium'?20:32;
    const selected=this.data.tiles.map(t=>{
      const px=(t.ix+.5)*meters,pz=(t.iz+.5)*meters;
      return {t,distance:Math.hypot(px-x,pz-z)};
    }).filter(v=>v.distance<=radius).sort((a,b)=>a.distance-b.distance)
      .slice(0,cap);
    const desired=new Set(selected.map(v=>v.t.id));
    for(const [id,mesh] of this.active){
      if(desired.has(id))continue;
      mesh.material?.dispose(true,true);
      mesh.dispose();
      this.active.delete(id);
    }
    const root=import.meta.env.BASE_URL+'data/4e/aerial/';
    for(const {t} of selected){
      if(this.active.has(t.id))continue;
      const x0=t.ix*meters,z0=t.iz*meters;
      const mesh=this.makePlane('ortho-'+t.id,
        [x0,z0,x0+meters,z0+meters],root+t.file,.045);
      this.active.set(t.id,mesh);
    }
  }
  private makePlane(name:string,bounds:readonly number[],url:string,y:number):Mesh{
    const [xmin,zmin,xmax,zmax]=bounds;
    const mesh=new Mesh(name,this.scene);
    const vertices=new VertexData();
    vertices.positions=[
      xmin,y,zmin,xmax,y,zmin,xmax,y,zmax,xmin,y,zmax
    ];
    vertices.indices=[0,2,1,0,3,2];
    vertices.normals=[0,1,0,0,1,0,0,1,0,0,1,0];
    // La photographie IGN est nord en haut, et l'axe z+ pointe au nord.
    vertices.uvs=[0,0,1,0,1,1,0,1];
    vertices.applyToMesh(mesh);
    const mat=new StandardMaterial('photo-'+name,this.scene);
    mat.diffuseTexture=new Texture(url,this.scene,false,true);
    mat.diffuseColor=Color3.White();
    mat.specularColor=Color3.Black();
    mat.backFaceCulling=false;
    mesh.material=mat;
    mesh.isPickable=false;
    mesh.freezeWorldMatrix();
    return mesh;
  }
}
