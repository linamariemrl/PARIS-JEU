import {
  Color3, Color4, DirectionalLight, DynamicTexture, HemisphericLight,
  Material, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3
} from '@babylonjs/core';
import { daylightFactor, lampFactor, lunarPosition, solarPosition } from './astronomy';
type RGB=[number,number,number];
const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v));
const blend=(a:RGB,b:RGB,t:number):RGB=>[
  a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t
];
function css(c:RGB):string {
  return 'rgb('+c.map(n=>Math.round(255*clamp(n,0,1))).join(',')+')';
}
function makeDisk(scene:Scene,kind:'sun'|'moon') {
  const map=new DynamicTexture(kind+'-disk',128,scene,true);
  const ctx=map.getContext() as unknown as CanvasRenderingContext2D;
  if(kind==='sun') {
    const g=ctx.createRadialGradient(64,64,7,64,64,62);
    g.addColorStop(0,'rgba(255,252,233,1)');
    g.addColorStop(.36,'rgba(255,247,201,.96)');
    g.addColorStop(.6,'rgba(255,227,140,.55)');
    g.addColorStop(1,'rgba(255,211,116,0)');
    ctx.fillStyle=g;ctx.fillRect(0,0,128,128);
    map.update(false);
  }
  map.hasAlpha=true;
  const material=new StandardMaterial(kind+'-disk-mat',scene);
  material.diffuseTexture=map;
  material.emissiveTexture=map;
  material.disableLighting=true;
  material.useAlphaFromDiffuseTexture=true;
  material.transparencyMode=Material.MATERIAL_ALPHABLEND;
  material.backFaceCulling=false;
  material.disableDepthWrite=true;
  const mesh=MeshBuilder.CreatePlane(kind+'-body',{size:kind==='sun'?165:68},scene);
  mesh.billboardMode=Mesh.BILLBOARDMODE_ALL;
  mesh.isPickable=false;
  mesh.applyFog=false;
  mesh.material=material;
  mesh.alwaysSelectAsActiveMesh=true;
  return {mesh,map,ctx};
}
function paintMoon(ctx:CanvasRenderingContext2D,texture:DynamicTexture,phase:number,fraction:number){
  const size=128, radius=53, cx=64,cy=64;
  const img=ctx.createImageData(size,size);
  const cosTerm=clamp(2*fraction-1,-1,1);
  const sinTerm=Math.sqrt(Math.max(0,1-cosTerm*cosTerm))*(phase<.5?1:-1);
  for(let y=0;y<size;y++){
    for(let x=0;x<size;x++){
      const nx=(x-cx)/radius,ny=(y-cy)/radius;
      const r2=nx*nx+ny*ny;
      if(r2>1)continue;
      const z=Math.sqrt(1-r2);
      const lit=nx*sinTerm+z*cosTerm;
      const shade=lit>0?1:0.09;
      const edge=clamp((1-r2)*12,0,1);
      const index=(y*size+x)*4;
      img.data[index]=Math.round(224*shade);
      img.data[index+1]=Math.round(228*shade);
      img.data[index+2]=Math.round(230*shade);
      img.data[index+3]=Math.round(edge*245);
    }
  }
  ctx.putImageData(img,0,0);
  texture.update(false);
}
export interface LightState {
  sunAltitudeDegrees:number;
  moonFraction:number;
  nightFactor:number;
}
export class SkyAndSun {
  private sky:Mesh;
  private texture:DynamicTexture;
  private ambient:HemisphericLight;
  private sunLight:DirectionalLight;
  private sun:ReturnType<typeof makeDisk>;
  private moon:ReturnType<typeof makeDisk>;
  private lastStep=-1;
  private lastMoonStep=-1;
  private lighting:LightState={sunAltitudeDegrees:0,moonFraction:0,nightFactor:0};

  constructor(private scene:Scene) {
    this.sun=makeDisk(scene,'sun');
    this.moon=makeDisk(scene,'moon');
    const skyMat=new StandardMaterial('ciel-procedural',scene);
    this.texture=new DynamicTexture('gradient-ciel',{width:512,height:256},scene,true);
    skyMat.emissiveTexture=this.texture;
    skyMat.diffuseTexture=this.texture;
    skyMat.disableLighting=true;
    skyMat.backFaceCulling=false;
    skyMat.disableDepthWrite=true;
    this.sky=MeshBuilder.CreateSphere('voute-celeste',{
      diameter:8900,segments:20,sideOrientation:Mesh.BACKSIDE
    },scene);
    this.sky.isPickable=false;
    this.sky.applyFog=false;
    this.sky.material=skyMat;
    this.sky.alwaysSelectAsActiveMesh=true;
    this.ambient=new HemisphericLight('ciel',new Vector3(0,1,0),scene);
    this.ambient.groundColor=new Color3(.16,.18,.25);
    this.sunLight=new DirectionalLight('soleil',new Vector3(-.5,-1,-.4),scene);
  }
  followCamera(){
    const camera=this.scene.activeCamera;
    if(!camera)return;
    this.sky.position.copyFrom(camera.position);
    // The celestial bodies are attached to the camera, direction from Paris.
    this.sun.mesh.position.copyFrom(camera.position).addInPlace(this.sunDirection.scale(4050));
    this.moon.mesh.position.copyFrom(camera.position).addInPlace(this.moonDirection.scale(3970));
  }
  private sunDirection=new Vector3(0,1,0);
  private moonDirection=new Vector3(0,-1,0);
  private drawSky(day:number,alt:number) {
    const nightTop:RGB=[.008,.018,.055],nightHorizon:RGB=[.055,.079,.13];
    const dawnTop:RGB=[.13,.22,.43],dawnHorizon:RGB=[.78,.41,.26];
    const dayTop:RGB=[.25,.48,.76],dayHorizon:RGB=[.74,.82,.87];
    const twilight=clamp(1-Math.abs(alt+1)/12,0,1)*(1-day*.45);
    const top=blend(blend(nightTop,dayTop,day),dawnTop,twilight*.38);
    const horizon=blend(blend(nightHorizon,dayHorizon,day),dawnHorizon,twilight*.78);
    const ctx=this.texture.getContext() as unknown as CanvasRenderingContext2D;
    const g=ctx.createLinearGradient(0,0,0,256);
    g.addColorStop(0,css(top));
    g.addColorStop(.48,css(blend(top,horizon,.52)));
    g.addColorStop(1,css(horizon));
    ctx.fillStyle=g;ctx.fillRect(0,0,512,256);
    // Fixed original star pattern. Points are aesthetic, not a star catalogue.
    const stars=clamp(1-day*2,0,1);
    let seed=74834;
    for(let n=0;n<180;n++){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed%512;
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;const y=seed%158;
      ctx.fillStyle='rgba(233,240,252,'+(stars*(0.24+seed%65/100)).toFixed(3)+')';
      ctx.fillRect(x,y,seed%11===0?2:1,1);
    }
    this.texture.update(false);
    const fog=blend(horizon,top,.34);
    this.scene.clearColor=new Color4(...fog,1);
    this.scene.fogColor=new Color3(...fog);
    this.scene.fogDensity=.00014+(1-day)*.00009;
  }
  update(epochMs:number):LightState {
    // Recomputed at most once per five minutes of simulation.
    const step=Math.floor(epochMs/300000);
    if(step===this.lastStep)return this.lighting;
    this.lastStep=step;
    const sun=solarPosition(epochMs);
    const moon=lunarPosition(epochMs);
    this.sunDirection.set(sun.east,sun.up,sun.north);
    this.moonDirection.set(moon.east,moon.up,moon.north);
    const alt=sun.altitude*180/Math.PI;
    const day=daylightFactor(sun.altitude);
    const night=lampFactor(sun.altitude);
    this.drawSky(day,alt);
    this.ambient.intensity=.15+.86*day;
    this.sunLight.intensity=Math.max(0,(day-.12)*1.3);
    this.sunLight.direction.copyFrom(this.sunDirection).scaleInPlace(-1);
    this.sun.mesh.setEnabled(sun.altitude>-0.13);
    this.moon.mesh.setEnabled(moon.altitude>0 && (day<.85 || moon.fraction>.35));
    const moonStep=Math.floor(epochMs/1800000);
    if(moonStep!==this.lastMoonStep){
      this.lastMoonStep=moonStep;
      paintMoon(this.moon.ctx,this.moon.map,moon.phase,moon.fraction);
    }
    this.lighting={sunAltitudeDegrees:alt,moonFraction:moon.fraction,nightFactor:night};
    return this.lighting;
  }
}
