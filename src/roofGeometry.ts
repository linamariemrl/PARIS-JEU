/** Formes de toit renseignées dans OpenStreetMap, raccordées par IoU à l'IGN.
 * La forme (type) est une donnée ouverte ; faute de hauteur OSM, les pentes
 * et proportions restent une estimation graphique.
 */
export type RoofShape='flat'|'gabled'|'hipped'|'mansard'|'gambrel'|
  'half-hipped'|'pyramidal'|'skillion';
export interface RoofInfo {
  shape:RoofShape;
  sourceId:number;
  score:number;
  height?:number;
  direction?:number;
}
export interface MapPoint{x:number;z:number;}
export interface RoofProfile {
  rise:number;
  eave:number;
  estimated:boolean;
  heightAt(point:MapPoint):number;
}
const clamp=(x:number,a:number,b:number)=>Math.max(a,Math.min(x,b));
const SUPPORTED=new Set<string>([
  'flat','gabled','hipped','mansard','gambrel',
  'half-hipped','pyramidal','skillion'
]);
export function roofShapeDescription(shape:string):string {
  const descriptions:Record<string,string>={
    flat:'toit plat',gabled:'toit à deux pans',hipped:'toit en croupe',
    mansard:'toit mansardé',gambrel:'toit brisé',
    'half-hipped':'toit à demi-croupe',pyramidal:'toit en pavillon',
    skillion:'toit monopente'
  };
  return descriptions[shape]||'forme non renseignée';
}
export function roofProfile(info:RoofInfo|undefined,totalHeight:number,
                            outline:MapPoint[]):RoofProfile|null {
  if(!info||!SUPPORTED.has(info.shape)||outline.length<3||
     !Number.isFinite(totalHeight)||totalHeight<2)return null;
  if(info.shape==='flat')return {
    rise:0,eave:totalHeight,estimated:false,heightAt:()=>totalHeight
  };
  const existing=info.height;
  const measured=existing!==undefined&&Number.isFinite(existing)&&
    existing>=.3&&existing<totalHeight*.65;
  const rise=measured ? existing :
    clamp(totalHeight*.17,.75,Math.min(5.4,totalHeight*.38));
  const eave=totalHeight-rise;
  let dir=0, length=0;
  for(let i=0;i<outline.length;i++){
    const p=outline[i],q=outline[(i+1)%outline.length];
    const dx=q.x-p.x,dz=q.z-p.z;
    const distance=Math.hypot(dx,dz);
    if(distance>length){length=distance;dir=Math.atan2(dz,dx);}
  }
  if(info.direction!==undefined&&Number.isFinite(info.direction)){
    // La direction OSM décrit le versant, pas la direction du faîtage.
    const direction=info.direction*Math.PI/180;
    dir=Math.atan2(Math.sin(direction),-Math.cos(direction));
  }
  const axisX=Math.cos(dir),axisZ=Math.sin(dir);
  let minU=Infinity,maxU=-Infinity,minV=Infinity,maxV=-Infinity;
  for(const p of outline){
    const u=p.x*axisX+p.z*axisZ;
    const v=-p.x*axisZ+p.z*axisX;
    minU=Math.min(minU,u);maxU=Math.max(maxU,u);
    minV=Math.min(minV,v);maxV=Math.max(maxV,v);
  }
  const midU=(minU+maxU)/2,midV=(minV+maxV)/2;
  const hU=Math.max(.5,(maxU-minU)/2),hV=Math.max(.5,(maxV-minV)/2);
  const heightAt=(p:MapPoint):number=>{
    const u=clamp(Math.abs((p.x*axisX+p.z*axisZ-midU)/hU),0,1);
    const v=clamp(Math.abs((-p.x*axisZ+p.z*axisX-midV)/hV),0,1);
    const cross=1-v;
    let factor=cross;
    if(info.shape==='hipped'||info.shape==='pyramidal')factor=Math.min(cross,1-u);
    if(info.shape==='half-hipped')factor=Math.min(cross,(1-u)*1.75);
    if(info.shape==='mansard'||info.shape==='gambrel'){
      const shoulder=info.shape==='mansard'?.78:.67;
      factor=cross<.25 ? shoulder*cross/.25 :
        shoulder+(1-shoulder)*(cross-.25)/.75;
    }
    if(info.shape==='skillion'){
      const sign=(-p.x*axisZ+p.z*axisX-midV)/hV;
      factor=clamp((sign+1)/2,0,1);
    }
    return eave+rise*clamp(factor,0,1);
  };
  return {rise,eave,estimated:!measured,heightAt};
}
