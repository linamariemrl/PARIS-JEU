import type {Engine} from '@babylonjs/core';

/** Résolution GPU automatique et discrète, sans modifier les emprises,
 * la portée du rendu ni les objets sélectionnables.
 *
 * Les changements sont espacés : aucune oscillation de netteté pendant
 * un panoramique ou une rotation, même si les FPS sont momentanément bas.
 * Le maintien des images est prioritaire sur le suréchantillonnage mobile.
 */
export type GraphicsQuality='low'|'medium'|'high';
export class AdaptiveResolution{
 private base=1.3;
 private max=1.85;
 private current=1.3;
 private previousCheck=0;
 private smoothedFps=60;
 private lowCount=0;
 private highCount=0;
 constructor(private engine:Engine){}
 configure(level:GraphicsQuality){
   const settings={
     low:{base:1.65,max:2.10},
     medium:{base:1.30,max:1.95},
     high:{base:1.00,max:1.63}
   }[level];
   this.base=settings.base;
   this.max=settings.max;
   this.current=this.base;
   this.smoothedFps=60;
   this.lowCount=0;
   this.highCount=0;
   this.previousCheck=performance.now();
   this.engine.setHardwareScalingLevel(this.current);
   this.engine.resize();
 }
 update(now:number,fps:number,isMoving:boolean){
   if(now-this.previousCheck<1900||!Number.isFinite(fps)||fps<=0)return;
   this.previousCheck=now;
   this.smoothedFps=this.smoothedFps*.34+fps*.66;
   if(this.smoothedFps<34){this.lowCount++;this.highCount=0;}
   else if(this.smoothedFps>56&&!isMoving){
     this.highCount++;this.lowCount=0;
   }else{this.lowCount=0;this.highCount=0;}
   let scale=this.current;
   // En mouvement, limiter les changements aux situations de FPS
   // réellement dégradés : l'utilisateur ne subit pas de flou variable.
   if(this.lowCount>=2&&(!isMoving||this.smoothedFps<26)){
     scale=Math.min(this.max,Math.round((scale+.10)*100)/100);
     this.lowCount=0;
   }else if(this.highCount>=4){
     scale=Math.max(this.base,Math.round((scale-.06)*100)/100);
     this.highCount=0;
   }
   if(Math.abs(scale-this.current)<.015)return;
   this.current=scale;
   this.engine.setHardwareScalingLevel(this.current);
   this.engine.resize();
 }
 get scale(){return this.current;}
}
