import type {Engine} from '@babylonjs/core';

/** Adaptation progressive de la résolution GPU.
 * Elle ne change jamais la géométrie, les arbres ni la distance de rendu.
 * Aucun changement pendant un geste, une inertie ou une transition 360°.
 */
export type GraphicsQuality='low'|'medium'|'high';
export class AdaptiveResolution{
 private base=1.3;
 private max=1.85;
 private current=1.3;
 private previousCheck=0;
 private lowCount=0;
 private highCount=0;
 constructor(private engine:Engine){}
 configure(level:GraphicsQuality){
   const settings={
     low:{base:1.65,max:2.05},
     medium:{base:1.30,max:1.83},
     high:{base:1.00,max:1.52}
   }[level];
   this.base=settings.base;
   this.max=settings.max;
   this.current=this.base;
   this.lowCount=0;
   this.highCount=0;
   this.previousCheck=performance.now();
   this.engine.setHardwareScalingLevel(this.current);
   this.engine.resize();
 }
 update(now:number,fps:number,isMoving:boolean){
   if(isMoving||now-this.previousCheck<8500)return;
   this.previousCheck=now;
   if(!Number.isFinite(fps)||fps<=0)return;
   if(fps<39){this.lowCount++;this.highCount=0;}
   else if(fps>56){this.highCount++;this.lowCount=0;}
   else {this.lowCount=0;this.highCount=0;}
   let scale=this.current;
   if(this.lowCount>=2){
     scale=Math.min(this.max,Math.round((scale+.10)*100)/100);
     this.lowCount=0;
   }else if(this.highCount>=3){
     scale=Math.max(this.base,Math.round((scale-.07)*100)/100);
     this.highCount=0;
   }
   if(Math.abs(scale-this.current)<.015)return;
   this.current=scale;
   this.engine.setHardwareScalingLevel(this.current);
   this.engine.resize();
 }
 get scale(){return this.current;}
}
