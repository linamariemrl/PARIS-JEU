import { Color3, DynamicTexture, Scene, StandardMaterial, Texture } from '@babylonjs/core';
import type { BuildingMaterials } from './buildings';
import type { FacadeCategory } from './facadeTexture';

const TYPES:FacadeCategory[]=['residential','commercial','religious','neutral'];
function emission(scene:Scene,category:FacadeCategory):DynamicTexture{
  const texture=new DynamicTexture('fenetres-nocturnes-'+category,
                                   {width:256,height:256},scene,true);
  const ctx=texture.getContext() as unknown as CanvasRenderingContext2D;
  ctx.fillStyle='#000000';
  ctx.fillRect(0,0,256,256);
  const centers=category==='commercial'?[61,189]:
                category==='religious'?[54,128,202]:
                category==='neutral'?[64,192]:[51,128,205];
  for(let c=0;c<centers.length;c++){
    const cx=centers[c];
    if(category==='religious')continue;
    const isLit=(c+ (category==='commercial'?0:1))%3!==0;
    if(!isLit)continue;
    const width=category==='commercial'?88:category==='neutral'?54:49;
    const top=category==='commercial'?25:42;
    const h=category==='commercial'?186:156;
    ctx.fillStyle=category==='commercial'?'#c7dfea':'#ffe2a0';
    ctx.fillRect(cx-width/2+7,top+8,width/2-11,h*0.43-7);
    if(c%2===0){
      ctx.fillStyle='#ffe4aa';
      ctx.fillRect(cx+5,top+h*0.57,width/2-13,h*0.36);
    }
  }
  texture.update(false);
  texture.wrapU=Texture.WRAP_ADDRESSMODE;
  texture.wrapV=Texture.WRAP_ADDRESSMODE;
  texture.hasAlpha=false;
  return texture;
}
/** Une texture et un état émissif par usage, pas un éclairage par fenêtre.
 * La répartition représente une occupation simulée, pas la réalité des logements.
 */
export function installNightWindows(scene:Scene,materials:BuildingMaterials){
  const maps={} as Record<FacadeCategory,DynamicTexture>;
  for(const type of TYPES){
    maps[type]=emission(scene,type);
    const material:StandardMaterial=materials[type];
    material.emissiveTexture=maps[type];
    material.emissiveColor=Color3.Black();
  }
  let previous=-1;
  return (factor:number,hour:number)=>{
    const step=Math.round(factor*20);
    const bucket=hour<6?0:hour<9?1:hour<18?2:hour<23?3:4;
    if(previous===step*10+bucket)return;
    previous=step*10+bucket;
    const occupationResidential=bucket===3?1:bucket===0?.4:bucket===2?.25:.6;
    const occupationCommercial=bucket===2?0.55:bucket===3?0.28:0.06;
    const occupationNeutral=0.35;
    const strength:Record<FacadeCategory,number>={
      residential:occupationResidential,commercial:occupationCommercial,
      religious:0,neutral:occupationNeutral
    };
    for(const type of TYPES){
      const p=factor*strength[type]*1.4;
      materials[type].emissiveColor.set(p,p*0.92,p*0.7);
    }
  };
}
