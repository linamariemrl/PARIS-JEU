/** Triangulation conforme au terrain mesuré IGN.
 *
 * Les polygones PVP/IGN/Paris Data sont déjà triangulés en XY par earcut.
 * Un triangle de rivière peut toutefois parcourir plusieurs kilomètres :
 * interpoler sa hauteur uniquement aux sommets provoque des « voiles »
 * traversant le relief entre les échantillons IGN à 200 m.
 *
 * Ce raffinement partage tous les milieux des arêtes entre les triangles
 * voisins : aucune fissure en T, aucune invention de nouvelles emprises.
 * Budget strict, pas d'allocation lors du rendu d'une frame.
 */
export interface RefinedPolygon{
  coordinates:number[];
  indices:number[];
  subdivided:boolean;
}
export function refineSurface(
  coordinates:readonly number[],indices:readonly number[],
  edgeLength=130,maxVertices=12000,maxPasses=7
):RefinedPolygon{
 const input=coordinates.length/2;
 if(!Number.isInteger(input)||input<3||!Number.isFinite(edgeLength)||
    edgeLength<=0||indices.length%3!==0)
  return {coordinates:[...coordinates],indices:[...indices],subdivided:false};
 const verts=[...coordinates];
 let faces=[...indices];
 const limit=Math.max(input,Math.floor(maxVertices));
 const edgeLimit=edgeLength*edgeLength;
 let subdivided=false;
 const key=(a:number,b:number)=>a<b?a*limit+b:b*limit+a;
 for(let round=0;round<maxPasses;round++){
  const need=new Set<number>();
  for(let t=0;t<faces.length;t+=3){
   const a=faces[t],b=faces[t+1],c=faces[t+2];
   for(const [u,v] of [[a,b],[b,c],[c,a]]){
    const dx=verts[2*u]-verts[2*v],dz=verts[2*u+1]-verts[2*v+1];
    if(dx*dx+dz*dz>edgeLimit)need.add(key(u,v));
   }
  }
  if(!need.size||verts.length/2+need.size>limit)break;
  const mids=new Map<number,number>();
  for(const k of need){
   const u=Math.floor(k/limit),v=k%limit;
   const index=verts.length/2;
   verts.push((verts[2*u]+verts[2*v])/2,
              (verts[2*u+1]+verts[2*v+1])/2);
   mids.set(k,index);
  }
  const next:number[]=[];
  const add=(a:number,b:number,c:number)=>next.push(a,b,c);
  for(let t=0;t<faces.length;t+=3){
   const a=faces[t],b=faces[t+1],c=faces[t+2];
   const ab=mids.get(key(a,b)),bc=mids.get(key(b,c)),
         ca=mids.get(key(c,a));
   const mask=(ab===undefined?0:1)|(bc===undefined?0:2)|
              (ca===undefined?0:4);
   switch(mask){
    case 0:add(a,b,c);break;
    case 1:add(a,ab!,c);add(ab!,b,c);break;
    case 2:add(b,bc!,a);add(bc!,c,a);break;
    case 4:add(c,ca!,b);add(ca!,a,b);break;
    case 3:add(b,bc!,ab!);add(a,ab!,c);add(ab!,bc!,c);break;
    case 6:add(c,ca!,bc!);add(b,bc!,a);add(bc!,ca!,a);break;
    case 5:add(a,ab!,ca!);add(c,ca!,b);add(ca!,ab!,b);break;
    case 7:add(a,ab!,ca!);add(ab!,b,bc!);add(ca!,bc!,c);
           add(ab!,bc!,ca!);break;
   }
  }
  faces=next;subdivided=true;
 }
 return {coordinates:verts,indices:faces,subdivided};
}

/** Un polygone est un habillage surfacique, pas un nouveau terrain.
 * Le profil vertical ne doit pas être recalculé en phase de rendu.
 */
export function appendDraped(
 target:{positions:number[];indices:number[]},
 flat:readonly number[],triangles:readonly number[],
 sample:(x:number,z:number)=>number,elevation:number,
 edgeLength=130,budget=12000
):number{
 if(!flat.length||!triangles.length)return 0;
 const refined=refineSurface(flat,triangles,edgeLength,budget);
 const base=target.positions.length/3;
 const {coordinates:xy,indices}=refined;
 for(let i=0;i<xy.length;i+=2){
  const x=xy[i],z=xy[i+1];
  target.positions.push(x,sample(x,z)+elevation,z);
 }
 for(const index of indices)target.indices.push(base+index);
 return xy.length/2;
}
