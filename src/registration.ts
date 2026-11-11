/** R02-D5 / R03-C : repère des maquettes en Lambert-93 (EPSG:2154).
 *
 * Chaîne de coordonnées, explicite à chaque étape :
 *   dessin historique (mètres du dessin, axes propres à la feuille)
 *     --(similitude ajustée sur plusieurs points d'appui)--> EPSG:2154
 *   master EPSG:2154 : sommets RELATIFS à `originL93` (précision float32)
 *     --(Lambert-93 inverse, GRS80)--> longitude/latitude RGF93
 *     --(même projection que src/geo.ts, centrée sur CENTER)--> scène x/z
 *   altitude NGF-IGN69 (m) - displayReferenceAltitudeM du MNT --> scène y
 *
 * Horizontal et vertical ne sont jamais mélangés. Les maquettes et les
 * emprises IGN passant par la même projection, leur alignement relatif ne
 * dépend pas de CENTER. Module pur (sans Babylon), testé sous Node.
 */
export type LonLat=[number,number];
export interface L93{e:number;n:number;}

// Lambert-93 : conique conforme sécante, GRS80 (paramètres EPSG:2154).
const A=6378137,F=1/298.257222101,E2=F*(2-F),E=Math.sqrt(E2);
const LAT1=44*Math.PI/180,LAT2=49*Math.PI/180,LAT0=46.5*Math.PI/180;
const LON0=3*Math.PI/180,X0=700000,Y0=6600000;
const m=(p:number)=>Math.cos(p)/Math.sqrt(1-E2*Math.sin(p)**2);
const t=(p:number)=>Math.tan(Math.PI/4-p/2)/
 Math.pow((1-E*Math.sin(p))/(1+E*Math.sin(p)),E/2);
const N=(Math.log(m(LAT1))-Math.log(m(LAT2)))/(Math.log(t(LAT1))-Math.log(t(LAT2)));
const FF=m(LAT1)/(N*Math.pow(t(LAT1),N));
const R0=A*FF*Math.pow(t(LAT0),N);

export function lonLatToL93([lon,lat]:LonLat):L93{
 const p=lat*Math.PI/180,l=lon*Math.PI/180;
 const r=A*FF*Math.pow(t(p),N),th=N*(l-LON0);
 return {e:X0+r*Math.sin(th),n:Y0+R0-r*Math.cos(th)};
}
export function l93ToLonLat({e,n}:L93):LonLat{
 const dx=e-X0,dy=R0-(n-Y0);
 const r=Math.sign(N)*Math.hypot(dx,dy),th=Math.atan2(dx,dy);
 const tt=Math.pow(r/(A*FF),1/N);
 let p=Math.PI/2-2*Math.atan(tt);
 for(let i=0;i<12;i++){
  const s=E*Math.sin(p);
  p=Math.PI/2-2*Math.atan(tt*Math.pow((1-s)/(1+s),E/2));
 }
 return [(th/N+LON0)*180/Math.PI,p*180/Math.PI];
}

/** Projection de scène, identique à `project` de src/geo.ts mais avec un
 * centre explicite (test d'indépendance au CENTER). */
export function projectWith(center:LonLat,[lon,lat]:LonLat){
 const mx=111320*Math.cos(center[1]*Math.PI/180),mz=111132;
 return {x:(lon-center[0])*mx,z:(lat-center[1])*mz};
}
export function unprojectWith(center:LonLat,x:number,z:number):LonLat{
 const mx=111320*Math.cos(center[1]*Math.PI/180),mz=111132;
 return [x/mx+center[0],z/mz+center[1]];
}

export interface SceneFrame{center:LonLat;displayReferenceAltitudeM:number;}
/** EPSG:2154 + altitude NGF -> coordonnées de scène. */
export function l93ToScene(p:L93,altitudeNGF:number,f:SceneFrame){
 const {x,z}=projectWith(f.center,l93ToLonLat(p));
 return {x,y:altitudeNGF-f.displayReferenceAltitudeM,z};
}
export function sceneToL93(x:number,y:number,z:number,f:SceneFrame){
 return {...lonLatToL93(unprojectWith(f.center,x,z)),
  altitudeNGF:y+f.displayReferenceAltitudeM};
}
/** Master relatif à `originL93` [E, N, altitude NGF] -> positions de scène. */
export function masterToScene(relative:ArrayLike<number>,
  origin:[number,number,number],f:SceneFrame):number[]{
 const out:number[]=[];
 for(let i=0;i+2<relative.length;i+=3){
  const q=l93ToScene({e:origin[0]+relative[i],n:origin[1]+relative[i+1]},
   origin[2]+relative[i+2],f);
  out.push(q.x,q.y,q.z);
 }
 return out;
}

/* ---- Calage d'une feuille : similitude 2D par moindres carrés ---------- */
export interface Similarity{scale:number;rotation:number;tx:number;ty:number;}
export interface TiePoint{id:string;drawing:[number,number];l93:[number,number];}
export function applySimilarity(s:Similarity,[u,v]:[number,number]):[number,number]{
 const c=s.scale*Math.cos(s.rotation),d=s.scale*Math.sin(s.rotation);
 return [c*u-d*v+s.tx,d*u+c*v+s.ty];
}
/** Au moins deux points d'appui DISTINCTS ; sinon null (pas de calage). */
export function fitSimilarity(points:TiePoint[]):Similarity|null{
 if(points.length<2)return null;
 const n=points.length;
 const mu=points.reduce((a,p)=>[a[0]+p.drawing[0]/n,a[1]+p.drawing[1]/n],[0,0]);
 const me=points.reduce((a,p)=>[a[0]+p.l93[0]/n,a[1]+p.l93[1]/n],[0,0]);
 let sxx=0,a=0,b=0;
 for(const p of points){
  const u=p.drawing[0]-mu[0],v=p.drawing[1]-mu[1];
  const x=p.l93[0]-me[0],y=p.l93[1]-me[1];
  sxx+=u*u+v*v;a+=u*x+v*y;b+=u*y-v*x;
 }
 if(sxx<1e-9)return null;
 const c=a/sxx,d=b/sxx;
 return {scale:Math.hypot(c,d),rotation:Math.atan2(d,c),
  tx:me[0]-(c*mu[0]-d*mu[1]),ty:me[1]-(d*mu[0]+c*mu[1])};
}
/** Résidus en mètres sur des points de CONTRÔLE indépendants. */
export function residuals(s:Similarity,controls:TiePoint[]):{id:string;meters:number}[]{
 return controls.map(p=>{
  const [e,n]=applySimilarity(s,p.drawing);
  return {id:p.id,meters:Math.hypot(e-p.l93[0],n-p.l93[1])};
 });
}

/* ---- Fiche de calage registration/PA########.json ---------------------- */
export interface Registration{
 schema:1;ref:string;sourceId:string;status:'unregistered'|'registered';
 originL93:[number,number,number]|null;
 tiePoints:TiePoint[];controlPoints:TiePoint[];
 transform:Similarity|null;rmsControlMeters:number|null;
}
/** Une fiche « registered » doit être recalculable : au moins 2 points
 * d'appui, au moins 1 point de contrôle indépendant, une similitude et une
 * erreur de contrôle qui correspondent au recalcul. Une fiche
 * « unregistered » ne porte ni origine, ni transformation, ni résidu. */
export function checkRegistration(r:Registration):string[]{
 const errors:string[]=[];
 if(r.schema!==1||!/^PA\d{8}$/.test(r.ref))errors.push('en-tête invalide');
 if(r.status==='unregistered'){
  if(r.originL93!==null||r.transform!==null||r.rmsControlMeters!==null)
   errors.push('fiche non calée portant des valeurs de calage');
  return errors;
 }
 if(r.status!=='registered'){errors.push('statut inconnu');return errors;}
 const ids=new Set(r.tiePoints.map(p=>p.id));
 if(r.controlPoints.some(p=>ids.has(p.id)))errors.push('contrôle non indépendant');
 const fit=fitSimilarity(r.tiePoints);
 if(!fit||r.controlPoints.length<1)errors.push('points insuffisants');
 if(!r.originL93)errors.push('origine absente');
 if(fit&&r.transform){
  const [e1,n1]=applySimilarity(fit,[0,0]),[e2,n2]=applySimilarity(r.transform,[0,0]);
  if(Math.hypot(e1-e2,n1-n2)>1e-3||Math.abs(fit.scale-r.transform.scale)>1e-9)
   errors.push('transformation non conforme au recalcul');
 }
 if(fit&&r.controlPoints.length){
  const res=residuals(fit,r.controlPoints);
  const rms=Math.sqrt(res.reduce((a,x)=>a+x.meters**2,0)/res.length);
  if(r.rmsControlMeters===null||Math.abs(rms-r.rmsControlMeters)>1e-3)
   errors.push('erreur de contrôle non conforme au recalcul');
 }
 return errors;
}
