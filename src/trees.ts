import {
  Color3, Matrix, Mesh, MeshBuilder, Quaternion,
  Scene, StandardMaterial, Vector3
} from '@babylonjs/core';

/** Arbres à coordonnées publiées par la Ville de Paris.
 * Couronnes et troncs schématiques : localisation mesurée, silhouette illustrative.
 * Les instances restent constamment chargées : aucun saut au zoom ou à 360°.
 */
interface TreeRecord{
  id:string;x:number;z:number;h:number;estimated:boolean;
  genre:string;domain:string;circumference:number;
}
interface TreesJson{
  schema:number;source:string;sourceUrl?:string;count:number;trees:TreeRecord[];
}
export type QualityLevel='low'|'medium'|'high';
const evergreen=new Set(['pinus','picea','cedrus','abies','taxus','thuja','cupressus','chamaecyparis']);
const identity=Quaternion.Identity();
const tones:[number,number,number][]=[
  [.34,.47,.35], [.40,.49,.32], [.31,.43,.37], [.47,.52,.35]
];
function material(scene:Scene,name:string,rgb:[number,number,number]){
  const mat=new StandardMaterial(name,scene);
  mat.diffuseColor=new Color3(...rgb);
  mat.specularColor=Color3.Black();
  mat.freeze();
  return mat;
}
function transform(x:number,y:number,z:number,sx:number,sy:number,sz:number):number[]{
  return Array.from(Matrix.Compose(new Vector3(sx,sy,sz),identity,
    new Vector3(x,y,z)).toArray());
}
function stableHash(value:string):number{
  let out=2166136261;
  for(let i=0;i<value.length;i++)out=Math.imul(out^value.charCodeAt(i),16777619);
  return out>>>0;
}
function instances(mesh:Mesh,transforms:number[]){
  if(!transforms.length){mesh.setEnabled(false);return;}
  mesh.thinInstanceSetBuffer('matrix',new Float32Array(transforms),16,true);
  mesh.thinInstanceRefreshBoundingInfo();
  mesh.setEnabled(true);
}
export class TreeLayer{
  private trunks:Mesh;
  private leaves:Mesh[];
  private conifers:Mesh;
  private initialized=false;
  private count=0;
  constructor(scene:Scene,private onStatus:(label:string)=>void){
    this.trunks=MeshBuilder.CreateCylinder('arbres-troncs-geolocalises',{
      height:1,diameter:1,tessellation:6
    },scene);
    this.trunks.material=material(scene,'écorce-douce',[.43,.39,.32]);
    this.leaves=tones.map((tone,i)=>{
      const mesh=MeshBuilder.CreateSphere('houppiers-ton-'+i,{
        diameter:2,segments:6
      },scene);
      mesh.material=material(scene,'feuillage-mat-'+i,tone);
      return mesh;
    });
    this.conifers=MeshBuilder.CreateCylinder('arbres-persistants-geolocalises',{
      height:2,diameterBottom:2,diameterTop:.03,tessellation:8
    },scene);
    this.conifers.material=material(scene,'persistants-mat',[.27,.38,.33]);
    for(const mesh of [this.trunks,...this.leaves,this.conifers]){
      mesh.isPickable=false;
      mesh.setEnabled(false);
      mesh.freezeWorldMatrix();
    }
  }
  async init():Promise<void>{
    const response=await fetch(import.meta.env.BASE_URL+'data/4e/trees.json');
    if(!response.ok){this.onStatus('Arbres municipaux : fichier absent');return;}
    const data=await response.json() as TreesJson;
    if(data.schema!==1||!Array.isArray(data.trees)||data.trees.length<100||
       data.trees.length!==data.count)throw Error('Arbres de Paris non vérifiés');
    const trunk:number[]=[],crown=tones.map(()=>[] as number[]),cone:number[]=[];
    const seen=new Set<string>();
    for(const item of data.trees){
      if(seen.has(item.id)||!Number.isFinite(item.x)||!Number.isFinite(item.z)||
         !Number.isFinite(item.h)||item.h<2||item.h>38)continue;
      seen.add(item.id);
      const h=item.h;
      const trunkHeight=h*.50;
      const width=item.circumference>0?
        Math.min(1.05,Math.max(.16,item.circumference/(100*Math.PI))):
        Math.min(.58,Math.max(.17,h*.035));
      trunk.push(...transform(item.x,trunkHeight/2,item.z,width,trunkHeight,width));
      const species=(item.genre||'').trim().toLowerCase();
      const radius=Math.min(5.8,Math.max(1.2,h*.30));
      if(evergreen.has(species)){
        cone.push(...transform(item.x,h*.68,item.z,
          radius*.88,h*.30,radius*.88));
      }else{
        const index=stableHash(item.id+'-'+species)%tones.length;
        crown[index].push(...transform(item.x,h*.76,item.z,
          radius,h*.26,radius));
      }
    }
    instances(this.trunks,trunk);
    this.leaves.forEach((mesh,index)=>instances(mesh,crown[index]));
    instances(this.conifers,cone);
    this.count=seen.size;
    this.initialized=true;
    this.onStatus(this.count.toLocaleString('fr-FR')+
      ' arbres municipaux géolocalisés (4e ; couronnes stylisées)');
  }
  setQuality(_quality:QualityLevel):void{
    // Aucun retrait d'arbres lorsqu'on change la résolution GPU.
    if(this.initialized)this.onStatus(this.count.toLocaleString('fr-FR')+
      ' arbres conservés au zoom et en rotation');
  }
}
