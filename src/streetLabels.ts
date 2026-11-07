import {
  ArcRotateCamera, DynamicTexture, Engine, Material, Matrix, Mesh,
  Scene, StandardMaterial, Vector3, VertexBuffer, VertexData
} from '@babylonjs/core';
import {
  collides,labelVisibility,STREET_LABEL_LIMIT,STREET_LABEL_MAX_RADIUS,
  type LabelRect
} from './streetLabelRules';
import {quadOnRoad,roadTextAltitude,worldHeightForPixelSize,
  type StreetAnchor} from './streetLabelGeometry';

interface StreetLabel extends StreetAnchor {
  id:string;
  streetId?:string;
  name:string;
  length:number;
}
interface StreetPayload {schema:number;namedStreets:number;labels:StreetLabel[];}
interface AtlasEntry {u0:number;u1:number;v0:number;v1:number;aspect:number;}
/** Noms de rues inscrits sur des quads physiques HORIZONTAUX.
 * Un maillage, une texture-atlas, 28 inscriptions au plus par vue.
 * AUCUN canvas 2D au-dessus de la scène et aucune position calculée
 * à partir de coordonnées écran. Les collisions écran ne concernent
 * que la décision de visibilité, jamais le point d'ancrage géographique.
 * L'occlusion des bâtiments est assurée par le tampon de profondeur GPU.
 */
export class StreetLabels {
  private entries:StreetLabel[]=[];
  private atlas:DynamicTexture|null=null;
  private mesh:Mesh|null=null;
  private slots=new Map<string,AtlasEntry>();
  private readonly identity=Matrix.Identity();
  private readonly positions=new Float32Array(STREET_LABEL_LIMIT*12);
  private readonly uvs=new Float32Array(STREET_LABEL_LIMIT*8);

  constructor(private scene:Scene,private engine:Engine){}

  async init():Promise<void>{
    const response=await fetch(import.meta.env.BASE_URL+'data/4e/street-names.json');
    if(!response.ok)throw Error('Référentiel officiel des rues indisponible');
    const data=await response.json() as StreetPayload;
    if(data.schema!==1||!Array.isArray(data.labels)||!data.labels.length){
      throw Error('Référentiel des rues invalide');
    }
    this.entries=data.labels.filter(l=>
      Boolean(l.name)&&Number.isFinite(l.x)&&Number.isFinite(l.z)&&
      Number.isFinite(l.angle)
    );
    this.makeAtlas();
    this.makeMesh();
    const status=document.getElementById('streets');
    if(status)status.textContent=
      data.namedStreets.toLocaleString('fr-FR')+' voies référencées';
  }

  private makeAtlas():void{
    const names=Array.from(new Set(this.entries.map(l=>l.name))).sort();
    // 4 colonnes x 64 lignes sur une texture commune, sans 205 matériaux GPU.
    const cols=4,rows=64,cellW=512,cellH=32;
    if(names.length>cols*rows)throw Error('Atlas des noms de rues trop petit');
    this.atlas=new DynamicTexture('noms-voies-ancrage-monde',
      {width:cols*cellW,height:rows*cellH},this.scene,false);
    this.atlas.hasAlpha=true;
    const ctx=this.atlas.getContext() as unknown as CanvasRenderingContext2D;
    ctx.clearRect(0,0,cols*cellW,rows*cellH);
    ctx.textAlign='center';
    ctx.textBaseline='middle';
    for(let i=0;i<names.length;i++){
      const name=names[i],col=i%cols,row=Math.floor(i/cols);
      let size=21;
      ctx.font='600 '+size+'px system-ui,Arial,sans-serif';
      while(ctx.measureText(name).width>cellW-20&&size>10){
        size--;
        ctx.font='600 '+size+'px system-ui,Arial,sans-serif';
      }
      const width=Math.min(cellW-8,ctx.measureText(name).width+14);
      const cx=col*cellW+cellW/2,cy=row*cellH+cellH/2;
      ctx.lineWidth=2;
      ctx.strokeStyle='rgba(244,239,226,.72)';
      ctx.fillStyle='#20343e';
      ctx.strokeText(name,cx,cy);
      ctx.fillText(name,cx,cy);
      const half=width/2;
      this.slots.set(name,{
        u0:(cx-half)/(cols*cellW),u1:(cx+half)/(cols*cellW),
        v0:1-((row+1)*cellH)/(rows*cellH),
        v1:1-(row*cellH)/(rows*cellH),
        aspect:width/cellH
      });
    }
    this.atlas.update(false);
  }

  private makeMesh():void {
    if(!this.atlas)throw Error('Atlas non initialisé');
    const mesh=new Mesh('odonymes-ancrés-chaussée',this.scene);
    const normals=new Float32Array(STREET_LABEL_LIMIT*12);
    const indices:number[]=[];
    for(let i=0;i<STREET_LABEL_LIMIT;i++){
      for(let v=0;v<4;v++)normals[i*12+v*3+1]=1;
      const n=i*4;
      indices.push(n,n+1,n+2,n,n+2,n+3);
    }
    const data=new VertexData();
    data.positions=this.positions;
    data.uvs=this.uvs;
    data.normals=normals;
    data.indices=indices;
    data.applyToMesh(mesh,true);
    const mat=new StandardMaterial('encre-des-noms-de-voies',this.scene);
    mat.diffuseTexture=this.atlas;
    mat.emissiveTexture=this.atlas;
    mat.disableLighting=true;
    mat.useAlphaFromDiffuseTexture=true;
    mat.transparencyMode=Material.MATERIAL_ALPHABLEND;
    mat.backFaceCulling=false;
    mat.disableDepthWrite=true;
    mat.alpha=.42;
    mesh.material=mat;
    mesh.isPickable=false;
    mesh.alwaysSelectAsActiveMesh=true;
    mesh.setEnabled(false);
    this.mesh=mesh;
  }

  update(radius:number,targetX:number,targetZ:number):void{
    const mesh=this.mesh;
    if(!mesh||radius>=STREET_LABEL_MAX_RADIUS){
      mesh?.setEnabled(false);
      return;
    }
    const camera=this.scene.activeCamera;
    if(!(camera instanceof ArcRotateCamera))return;
    const canvas=this.engine.getRenderingCanvas();
    const cssWidth=canvas?.clientWidth||window.innerWidth;
    const cssHeight=canvas?.clientHeight||window.innerHeight;
    const renderWidth=this.engine.getRenderWidth();
    const renderHeight=this.engine.getRenderHeight();
    const viewport=camera.viewport.toGlobal(renderWidth,renderHeight);
    const transform=this.scene.getTransformMatrix();
    const available=this.entries.map(street=>{
      const dx=street.x-targetX,dz=street.z-targetZ;
      const distance=Math.hypot(dx,dz);
      return {street,distance,visibility:labelVisibility(radius,distance)};
    }).filter(item=>item.visibility>.15).sort((a,b)=>a.distance-b.distance);

    const occupied:LabelRect[]=[];
    let count=0;
    this.positions.fill(0);
    this.uvs.fill(0);
    for(const item of available){
      if(count>=STREET_LABEL_LIMIT)break;
      const label=item.street;
      const atlas=this.slots.get(label.name);
      if(!atlas)continue;
      const y=roadTextAltitude(label.kind);
      const center=new Vector3(label.x,y,label.z);
      const screen=Vector3.Project(center,this.identity,transform,viewport);
      if(!Number.isFinite(screen.z)||screen.z<=0||screen.z>=1)continue;
      const x=screen.x*cssWidth/renderWidth;
      const screenY=screen.y*cssHeight/renderHeight;
      const physicalDistance=Vector3.Distance(camera.position,center);
      const quadHeight=worldHeightForPixelSize(physicalDistance,camera.fov,cssHeight);
      const textPx=Math.min(14,quadHeight/
         (2*physicalDistance*Math.tan(camera.fov/2))*cssHeight);
      const halfW=atlas.aspect*textPx/2+3;
      const halfH=Math.max(6,textPx*.5)+3;
      const rect:LabelRect={left:x-halfW,right:x+halfW,
        top:screenY-halfH,bottom:screenY+halfH};
      if(rect.left<8||rect.right>cssWidth-82||
         rect.top<155||rect.bottom>cssHeight-55||
         collides(rect,occupied))continue;

      // La géométrie est reconstruite AUTOUR du même (x,z) officiel.
      // Le centre du quad ne bouge jamais avec le zoom.
      const quad=quadOnRoad(label,quadHeight*atlas.aspect,quadHeight);
      this.positions.set(quad,count*12);
      const uv=count*8;
      this.uvs.set([
        atlas.u0,atlas.v0, atlas.u1,atlas.v0,
        atlas.u1,atlas.v1, atlas.u0,atlas.v1
      ],uv);
      occupied.push(rect);
      count++;
    }
    if(!count){mesh.setEnabled(false);return;}
    mesh.updateVerticesData(VertexBuffer.PositionKind,this.positions,false,false);
    mesh.updateVerticesData(VertexBuffer.UVKind,this.uvs,false,false);
    mesh.setEnabled(true);
  }
}
