import { Color3, Matrix, Mesh, MeshBuilder, Quaternion, Scene, StandardMaterial, Vector3 } from '@babylonjs/core';
import type { QualityLevel } from './trees';
interface NamedStreet{x:number;z:number;angle:number;name:string;id:string}
interface StreetData{schema:number;labels:NamedStreet[]}
interface Point{x:number;z:number;id:string}
const quat=Quaternion.Identity();
function transform(x:number,y:number,z:number,sx:number,sy:number,sz:number):number[]{
  return Array.from(Matrix.Compose(new Vector3(sx,sy,sz),quat,new Vector3(x,y,z)).toArray());
}
function hash(id:string){
  let h=2166136261;
  for(const char of id)h=Math.imul(h^char.charCodeAt(0),16777619);
  return h>>>0;
}
/** Mobilier schématique généré près des axes de voies officiellement nommées.
 * Ces points ne prétendent PAS être un inventaire des lampadaires installés.
 * Trois maillages instanciés, aucune vraie source lumineuse par lampadaire.
 */
export class StreetLighting {
  private poles:Mesh;
  private bulbs:Mesh;
  private poleMaterial:StandardMaterial;
  private bulbMaterial:StandardMaterial;
  private points:Point[]=[];
  private cameraX=0;
  private cameraZ=0;
  private lastX=Infinity;
  private lastZ=Infinity;
  private intensity=0;
  private quality:QualityLevel='medium';
  private ready=false;
  private count=0;
  constructor(private scene:Scene){
    this.poles=MeshBuilder.CreateCylinder('lampadaires-stylises',{
      height:1,diameter:.16,tessellation:5
    },scene);
    this.bulbs=MeshBuilder.CreateSphere('globes-eclairage',{diameter:1,segments:4},scene);
    this.poleMaterial=new StandardMaterial('lampadaires-metal',scene);
    this.poleMaterial.diffuseColor=new Color3(.27,.32,.35);
    this.bulbMaterial=new StandardMaterial('globes-lumineux',scene);
    this.bulbMaterial.diffuseColor=new Color3(.65,.66,.55);
    this.bulbMaterial.emissiveColor=Color3.Black();
    this.poles.material=this.poleMaterial;
    this.bulbs.material=this.bulbMaterial;
    this.poles.isPickable=false;this.bulbs.isPickable=false;
    this.poles.setEnabled(false);this.bulbs.setEnabled(false);
  }
  async init():Promise<void>{
    const response=await fetch(import.meta.env.BASE_URL+'data/4e/street-names.json');
    if(!response.ok)return;
    const data=await response.json() as StreetData;
    if(data.schema!==1 || !Array.isArray(data.labels))return;
    const visited=new Set<string>();
    for(const entry of data.labels){
      const rad=entry.angle*Math.PI/180;
      const forwardX=Math.cos(rad),forwardZ=Math.sin(rad);
      const rightX=-forwardZ,rightZ=forwardX;
      for(const distance of [-34,0,34]){
        const side=(hash(entry.id+distance)%2===0)?1:-1;
        const x=entry.x+forwardX*distance+rightX*side*5.8;
        const z=entry.z+forwardZ*distance+rightZ*side*5.8;
        const cell=Math.floor(x/14)+':'+Math.floor(z/14);
        if(visited.has(cell))continue;
        visited.add(cell);
        this.points.push({x,z,id:entry.id+'-'+distance});
      }
    }
    this.ready=this.points.length>0;
    this.rebuild();
  }
  setQuality(quality:QualityLevel){
    this.quality=quality;
    this.lastX=Infinity;
    this.rebuild();
  }
  updatePosition(x:number,z:number){
    if(!this.ready)return;
    if(Math.hypot(x-this.lastX,z-this.lastZ)<150)return;
    this.cameraX=x;this.cameraZ=z;
    this.rebuild();
  }
  updateBrightness(factor:number){
    this.intensity=factor;
    // L'allumage suit le soleil : le rendu utilise une émission simulée,
    // sans 500 lampes ponctuelles GPU.
    this.bulbMaterial.emissiveColor.set(factor*.98,factor*.78,factor*.48);
    this.bulbMaterial.diffuseColor.set(.28+factor*.57,.30+factor*.43,.27+factor*.27);
  }
  private rebuild(){
    if(!this.ready)return;
    this.lastX=this.cameraX;this.lastZ=this.cameraZ;
    const radius=this.quality==='low'?520:this.quality==='medium'?760:1000;
    const density=this.quality==='low'?.32:this.quality==='medium'?.63:1;
    const poleMatrices:number[]=[];
    const bulbMatrices:number[]=[];
    this.count=0;
    for(const p of this.points){
      const dx=p.x-this.cameraX,dz=p.z-this.cameraZ;
      if(dx*dx+dz*dz>radius*radius)continue;
      if((hash(p.id)%1000)/1000>density)continue;
      poleMatrices.push(...transform(p.x,2.7,p.z,1,5.4,1));
      bulbMatrices.push(...transform(p.x,5.55,p.z,.62,.5,.62));
      this.count++;
    }
    for(const [mesh,matrices] of [
      [this.poles,poleMatrices],[this.bulbs,bulbMatrices]
    ] as [Mesh,number[]][]){
      mesh.thinInstanceSetBuffer('matrix',new Float32Array(matrices),16,true);
      mesh.thinInstanceRefreshBoundingInfo();
      mesh.setEnabled(matrices.length>0);
    }
  }
}
