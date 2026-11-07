/** Quads cartographiques en coordonnées 3D réelles, sans repositionnement écran.
 * Le centre de chaque inscription reste EXACTEMENT l'ancre géographique,
 * indépendamment du zoom, de l'inclinaison et de l'orientation de la caméra.
 */
export interface StreetAnchor {
  x:number;
  z:number;
  angle:number;
  kind:string;
}
export function roadTextAltitude(kind:string):number {
  return kind==='pont'||kind==='passerelle' ? 2.29 : 0.215;
}
export function quadOnRoad(a:StreetAnchor,width:number,height:number):number[] {
  const theta=a.angle*Math.PI/180;
  const vx=Math.cos(theta),vz=Math.sin(theta);
  const nx=vz,nz=-vx;
  const halfW=width/2,halfH=height/2;
  const y=roadTextAltitude(a.kind);
  return [
    a.x-vx*halfW-nx*halfH,y,a.z-vz*halfW-nz*halfH,
    a.x+vx*halfW-nx*halfH,y,a.z+vz*halfW-nz*halfH,
    a.x+vx*halfW+nx*halfH,y,a.z+vz*halfW+nz*halfH,
    a.x-vx*halfW+nx*halfH,y,a.z-vz*halfW+nz*halfH
  ];
}
export function roadQuadCenter(points:readonly number[]):{x:number;y:number;z:number} {
  if(points.length!==12)throw Error('Un texte cartographique exige quatre sommets');
  return {
    x:(points[0]+points[3]+points[6]+points[9])/4,
    y:(points[1]+points[4]+points[7]+points[10])/4,
    z:(points[2]+points[5]+points[8]+points[11])/4
  };
}
export function worldHeightForPixelSize(distance:number,fov:number,cssHeight:number):number {
  // Un texte modeste, de taille proche de 9 pixels sur l'écran Android.
  // Le redimensionnement du quad ne touche jamais à son centre/ancre.
  if(distance<=0||cssHeight<=0||!Number.isFinite(fov))return .32;
  return Math.max(.32,Math.min(1.5,2*distance*Math.tan(fov/2)*14/cssHeight));
}
