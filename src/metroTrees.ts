import {
  Color3,Mesh,MeshBuilder,Scene,StandardMaterial
} from '@babylonjs/core';

import {terrainHeight} from './terrain';

const PREFIX=import.meta.env.BASE_URL+'data/metropole/trees/';
type Quality='low'|'medium'|'high';
interface TileInfo{id:string;ix:number;iz:number;count:number;bytes:number;}
interface Manifest {
 schema:1;source:string;count:number;tileMeters:800;
 quantizationMeters:.25;recordBytes:7;tiles:TileInfo[];
}
interface Loaded{meshes:Mesh[];count:number;lastUsed:number;}
const RGB={
 trunk:[.43,.39,.32] as [number,number,number],
 light:[.39,.50,.37] as [number,number,number],
 dark:[.31,.44,.35] as [number,number,number],
 conifer:[.26,.39,.34] as [number,number,number]
};

function material(scene:Scene,name:string,values:[number,number,number]){
 const mat=new StandardMaterial(name,scene);
 mat.diffuseColor=new Color3(...values);
 mat.specularColor=Color3.Black();
 mat.freeze();
 return mat;
}
function one(matrices:number[],x:number,y:number,z:number,
 sx:number,sy:number,sz:number){
 matrices.push(sx,0,0,0,0,sy,0,0,0,0,sz,0,x,y,z,1);
}
/** Charge les arbres enregistrés, sans créer d'arbres dans les bois non
 * inventoriés. Les arbres restent fixes pendant toute rotation 360°.
 */
export class MetroTreeLayer{
 private manifest:Manifest|null=null;
 private tiles:TileInfo[]=[];
 private active=new Map<string,Loaded>();
 private fetching=new Set<string>();
 private errors=new Map<string,number>();
 private wanted=new Set<string>();
 private budget=14;
 private hiddenFar=false;
 private lastUpdate=0;
 private prevX=Infinity;
 private prevZ=Infinity;
 private prevRadius=Infinity;
 private materials:{
  trunk:StandardMaterial;light:StandardMaterial;
  dark:StandardMaterial;conifer:StandardMaterial;
 };
 constructor(private scene:Scene,private onStatus:(label:string)=>void){
   this.materials={
    trunk:material(scene,'arbres-metropole-ecorce',RGB.trunk),
    light:material(scene,'arbres-metropole-houppier-clair',RGB.light),
    dark:material(scene,'arbres-metropole-houppier-sombre',RGB.dark),
    conifer:material(scene,'arbres-metropole-coniferes',RGB.conifer)
   };
 }
 async init():Promise<void>{
   try{
    const response=await fetch(PREFIX+'manifest.json');
    if(!response.ok){
      this.onStatus('Autres arrondissements : arbres non encore publiés');
      return;
    }
    const data=await response.json() as Manifest;
    if(data.schema!==1||data.recordBytes!==7||
       data.tileMeters!==800||data.quantizationMeters!==.25||
       data.count<50000||!Array.isArray(data.tiles)||data.tiles.length<60||
       data.tiles.reduce((sum,t)=>sum+t.count,0)!==data.count)
      throw Error('Manifeste des arbres invalide');
    this.manifest=data;
    this.tiles=data.tiles;
    this.report();
   }catch(error){
    console.warn('Arbres des autres arrondissements',error);
    this.onStatus('Arbres des autres arrondissements non disponibles');
   }
 }
 setQuality(level:Quality){
   this.budget=level==='low'?8:level==='high'?20:14;
   this.prevX=Infinity;
 }
 update(x:number,z:number,radius:number){
  if(!this.manifest)return;
  const now=performance.now();
  if(now-this.lastUpdate<310)return;
  const moved=Math.hypot(x-this.prevX,z-this.prevZ)>110||
    Math.abs(radius-this.prevRadius)>400;
  if(!moved&&now-this.lastUpdate<1700)return;
  this.lastUpdate=now;this.prevX=x;this.prevZ=z;this.prevRadius=radius;
  // La géométrie arborée n'est pas dessinée quand les houppiers
  // deviennent inférieurs au pixel. Les emprises végétales SIG restent.
  if(!this.hiddenFar&&radius>6500){
    for(const state of this.active.values())
      state.meshes.forEach(mesh=>mesh.setEnabled(false));
    this.hiddenFar=true;
  }else if(this.hiddenFar&&radius<4700){
    for(const state of this.active.values())
      state.meshes.forEach(mesh=>mesh.setEnabled(true));
    this.hiddenFar=false;
  }
  if(this.hiddenFar)return;
  const range=Math.max(1200,Math.min(2600,radius*1.25));
  const candidates=this.tiles.filter(t=>
    Math.hypot((t.ix+.5)*800-x,(t.iz+.5)*800-z)<range
  ).sort((a,b)=>{
    const dx=(a.ix+.5)*800-x,dz=(a.iz+.5)*800-z;
    const ex=(b.ix+.5)*800-x,ez=(b.iz+.5)*800-z;
    return dx*dx+dz*dz-ex*ex-ez*ez;
  }).slice(0,this.budget);
  this.wanted=new Set(candidates.map(t=>t.id));
  for(const id of this.wanted){
    const current=this.active.get(id);
    if(current)current.lastUsed=now;
  }
  for(const tile of candidates){
    if(this.fetching.size>=2)break;
    if(this.active.has(tile.id)||this.fetching.has(tile.id)||
       now-(this.errors.get(tile.id)??-Infinity)<15000)continue;
    if(!this.makeRoom(x,z))break;
    void this.load(tile);
  }
 }
 private makeRoom(x:number,z:number):boolean{
   if(this.active.size+this.fetching.size<this.budget)return true;
   const available=[...this.active.entries()].filter(([id])=>
     !this.wanted.has(id)).sort((a,b)=>{
       const distance=(id:string)=>{
        const [ix,iz]=id.split('_').map(Number);
        return Math.hypot((ix+.5)*800-x,(iz+.5)*800-z);
       };
       return distance(b[0])-distance(a[0])||
         a[1].lastUsed-b[1].lastUsed;
     });
   if(!available.length)return false;
   const [id,state]=available[0];
   state.meshes.forEach(mesh=>mesh.dispose());
   this.active.delete(id);
   return true;
 }
 private mesh(kind:'trunk'|'light'|'dark'|'conifer',
   buffers:number[],id:string):Mesh|null{
   if(!buffers.length)return null;
   const mesh=kind==='trunk'?MeshBuilder.CreateCylinder('troncs-'+id,
    {height:1,diameter:1,tessellation:5},this.scene):
    kind==='conifer'?MeshBuilder.CreateCylinder('persistants-'+id,
      {height:2,diameterBottom:2,diameterTop:.03,tessellation:6},this.scene):
      MeshBuilder.CreateSphere('feuillus-'+kind+'-'+id,
        {diameter:2,segments:5},this.scene);
   mesh.material=this.materials[kind];
   mesh.isPickable=false;
   mesh.thinInstanceSetBuffer('matrix',new Float32Array(buffers),16,true);
   mesh.thinInstanceRefreshBoundingInfo();
   mesh.freezeWorldMatrix();
   return mesh;
 }
 private async load(tile:TileInfo):Promise<void>{
   this.fetching.add(tile.id);
   try{
     const response=await fetch(PREFIX+tile.id+'.bin');
     if(!response.ok)throw Error('Tuile arbres absente '+tile.id);
     const buffer=await response.arrayBuffer();
     if(buffer.byteLength!==tile.bytes||tile.bytes!==tile.count*7)
       throw Error('Tuile arbres tronquée '+tile.id);
     if(!this.wanted.has(tile.id))return;
     const data=new DataView(buffer);
     const trunk:number[]=[],light:number[]=[],dark:number[]=[],conifer:number[]=[];
     for(let i=0;i<tile.count;i++){
       const at=i*7;
       const x=tile.ix*800+data.getInt16(at,true)*.25;
       const z=tile.iz*800+data.getInt16(at+2,true)*.25;
       const h=Math.max(2,data.getUint8(at+4)*.25);
       const ground=terrainHeight(x,z);
       const kind=data.getUint8(at+5);
       const diameter=Math.max(.12,data.getUint8(at+6)*.02);
       const trunkH=h*.50;
       const radius=Math.max(1.2,Math.min(5.8,h*.30));
       one(trunk,x,ground+trunkH/2,z,diameter,trunkH,diameter);
       if(kind===2)
         one(conifer,x,ground+h*.68,z,radius*.88,h*.16,radius*.88);
       else
         one(kind===0?light:dark,x,ground+h*.76,z,radius,h*.26,radius);
     }
     const meshes=(['trunk','light','dark','conifer'] as const)
       .map((name,i)=>this.mesh(name,[trunk,light,dark,conifer][i],tile.id))
       .filter((mesh):mesh is Mesh=>mesh!==null);
     this.active.set(tile.id,{meshes,count:tile.count,lastUsed:performance.now()});
     this.errors.delete(tile.id);
   }catch(error){
     console.warn('Arbres municipaux',tile.id,error);
     this.errors.set(tile.id,performance.now());
   }finally{
     this.fetching.delete(tile.id);
     this.prevX=Infinity;
     this.report();
   }
 }
 private report(){
   const n=[...this.active.values()].reduce((sum,t)=>sum+t.count,0);
   this.onStatus(n.toLocaleString('fr-FR')+
     ' arbres des autres arrondissements chargés / '+
     (this.manifest?.count??0).toLocaleString('fr-FR')+' indexés'+
     (this.errors.size?' · '+this.errors.size+' secteurs à réessayer':''));
 }
}
