import { DynamicTexture, Scene, Texture } from '@babylonjs/core';
import { WALL_SURFACES, ROOF_SURFACES, type WallSurface, type RoofSurface } from './materialCatalog';

/** Habillages procéduraux par fonction IGN, non par date de construction.
 * Le revêtement matériel précis et le style historique individuel ne sont
 * pas présents dans la BD TOPO. On ne les invente pas dans les métadonnées.
 */
export type FacadeCategory = 'residential' | 'commercial' | 'religious' | 'neutral';
export type SurfaceCategory = FacadeCategory | 'roof' | WallSurface | RoofSurface;

function drawDocumentedTexture(ctx:CanvasRenderingContext2D,kind:WallSurface|RoofSurface) {
  const wall=kind.startsWith('wall-');
  const base:Record<string,string>={
    'wall-stone':'#d9c7af','wall-millstone':'#a28c76',
    'wall-concrete':'#c8c9c6','wall-brick':'#a8796b',
    'wall-aggregate':'#c8c0ad','wall-wood':'#b0916c',
    'roof-tile':'#b76c52','roof-slate':'#60676b',
    'roof-zinc':'#929ca4','roof-concrete':'#868c89'
  };
  ctx.fillStyle=base[kind];
  ctx.fillRect(0,0,256,256);
  if(kind==='wall-stone') {
    ctx.fillStyle='rgba(92,76,58,.16)';
    for(let y=0;y<256;y+=26){
      ctx.fillRect(0,y,256,2);
      for(let x=(y%52?12:0);x<256;x+=80)ctx.fillRect(x,y+1,1,25);
    }
  } else if(kind==='wall-brick'){
    ctx.fillStyle='rgba(78,62,53,.25)';
    for(let y=0;y<256;y+=12){
      ctx.fillRect(0,y,256,2);
      for(let x=(y%24?21:0);x<256;x+=43)ctx.fillRect(x,y,2,12);
    }
  } else if(kind==='wall-millstone'){
    let seed=6471;
    for(let i=0;i<340;i++){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;const x=seed%256;
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;const y=seed%256;
      ctx.fillStyle=i%2?'#927960':'#c2a88b';
      ctx.fillRect(x,y,3+(seed%9),2+(seed%5));
    }
  } else if(kind==='wall-wood'){
    for(let x=0;x<256;x+=18){
      ctx.fillStyle='rgba(70,45,20,.19)';
      ctx.fillRect(x,0,2,256);
      ctx.fillStyle='rgba(241,213,165,.18)';
      ctx.fillRect(x+4,0,3,256);
    }
  } else if(kind==='wall-concrete'||kind==='wall-aggregate'){
    for(let y=0;y<256;y+=54){
      ctx.fillStyle='rgba(66,70,65,.11)';ctx.fillRect(0,y,256,2);
    }
  } else if(kind==='roof-zinc'){
    for(let x=0;x<256;x+=22){
      ctx.fillStyle='#bdc6cc';ctx.fillRect(x,0,2,256);
      ctx.fillStyle='rgba(41,56,65,.25)';ctx.fillRect(x+3,0,1,256);
    }
    ctx.fillStyle='rgba(45,52,55,.11)';
    for(let y=0;y<256;y+=70)ctx.fillRect(0,y,256,2);
  } else if(kind==='roof-slate'){
    for(let y=0;y<256;y+=14){
      ctx.fillStyle='rgba(30,40,50,.25)';ctx.fillRect(0,y,256,1);
      for(let x=(y%28?11:0);x<256;x+=27)ctx.fillRect(x,y,1,14);
    }
  } else if(kind==='roof-tile'){
    for(let y=0;y<256;y+=18){
      ctx.fillStyle='rgba(89,42,31,.21)';ctx.fillRect(0,y,256,2);
      for(let x=(y%36?17:0);x<256;x+=34)ctx.fillRect(x,y,2,18);
    }
  } else if(kind==='roof-concrete'){
    for(let y=0;y<256;y+=65){
      ctx.fillStyle='rgba(49,57,55,.19)';ctx.fillRect(0,y,256,2);
    }
  }
  if(wall) {
    // Le matériau fiscal décrit le gros oeuvre et non le parement visible.
    // Plus de pierre apparente, ouvertures plus étroites et peu réfléchissantes.
    ctx.fillStyle='rgba(66,57,49,.12)';
    for(let y=22;y<245;y+=70)ctx.fillRect(0,y,256,2);
    const dark=kind==='wall-concrete'||kind==='wall-aggregate';
    for(const center of [45,128,211]){
      const w=dark?37:33,top=67,h=112;
      const x=center-w/2;
      ctx.fillStyle=dark?'#aaadae':'#eee1cc';
      ctx.fillRect(x-5,top-6,w+10,h+13);
      ctx.fillStyle=dark?'#46535c':'#364751';
      ctx.fillRect(x,top,w,h);
      ctx.fillStyle='#70818a';
      ctx.fillRect(x+3,top+4,w-6,h-9);
      ctx.fillStyle='rgba(222,231,227,.20)';
      ctx.fillRect(x+4,top+5,w*.25,h*.53);
      ctx.fillStyle='#d7d2c8';
      ctx.fillRect(center-1,top,2,h);
      ctx.fillRect(x,top+h*.52,w,2);
      ctx.fillStyle='rgba(65,58,54,.80)';
      ctx.fillRect(x-5,top+h-17,w+10,2);
      // Garde-corps : simple dessin illustratif, pas un relevé précis.
      if(!dark){
        ctx.fillRect(x-4,top+h-15,w+8,2);
        for(let n=0;n<5;n++)
          ctx.fillRect(x+n*(w-2)/4,top+h-13,1,10);
      }
      ctx.fillStyle='rgba(245,239,225,.60)';
      ctx.fillRect(x-7,top-10,w+14,3);
    }
    ctx.fillStyle='rgba(103,92,79,.18)';
    ctx.fillRect(0,238,256,5);
    ctx.fillStyle='rgba(246,239,220,.24)';
    ctx.fillRect(0,245,256,5);
  }
}
function texture(scene: Scene, category: SurfaceCategory): DynamicTexture {
  const img = new DynamicTexture('revetement-' + category,
    { width: 256, height: 256 }, scene, true);
  const ctx = img.getContext() as unknown as CanvasRenderingContext2D;
  ctx.save();
  ctx.clearRect(0,0,256,256);
  if(category.startsWith('wall-')||category.startsWith('roof-')){
    drawDocumentedTexture(ctx,category as WallSurface|RoofSurface);
    ctx.restore();
    img.update(false);
    img.wrapU=Texture.WRAP_ADDRESSMODE;
    img.wrapV=Texture.WRAP_ADDRESSMODE;
    img.hasAlpha=false;
    return img;
  }
  const base = category === 'residential' ? '#dfd3bf' :
    category === 'commercial' ? '#d4d8d7' :
    category === 'religious' ? '#cbbfa9' :
    category === 'roof' ? '#737e84' : '#d6cec1';
  ctx.fillStyle = base;
  ctx.fillRect(0,0,256,256);

  if (category === 'roof') {
    // Texture de couverture métallique neutre, sans prétendre à un toit en
    // zinc réel pour chaque immeuble : le matériau reste non vérifié.
    for (let x=0; x<256; x+=24) {
      ctx.fillStyle = '#879097'; ctx.fillRect(x,0,2,256);
      ctx.fillStyle = '#5f6a70'; ctx.fillRect(x+3,0,1,256);
    }
    for (let y=0; y<256; y+=64) {
      ctx.fillStyle='#6b757b';ctx.fillRect(0,y,256,1);
    }
  } else {
    // Maçonnerie et assises au pas d'un étage, sans géométrie en plus.
    ctx.fillStyle = category==='commercial'?'#c0c7c7':'#c7bbaa';
    for(let y=0;y<256;y+=34)ctx.fillRect(0,y,256,1);
    if (category!=='commercial') {
      ctx.fillStyle='rgba(93,89,78,0.10)';
      for(let y=0;y<256;y+=34){
        for(let x=(y%68===0?0:22);x<256;x+=52)ctx.fillRect(x,y+1,1,33);
      }
    }

    if(category==='religious'){
      for(const cx of [60,128,196]){
        ctx.fillStyle='#e7dac2';
        ctx.fillRect(cx-14,63,28,122);
        ctx.beginPath();ctx.arc(cx,63,14,Math.PI,0);ctx.fill();
        ctx.fillStyle='#42525a';
        ctx.fillRect(cx-10,67,20,110);
        ctx.beginPath();ctx.arc(cx,67,10,Math.PI,0);ctx.fill();
        ctx.fillStyle='#9cb1b5';ctx.fillRect(cx-1,67,2,110);
      }
    }else{
      // Le bâti sans documentation de style reste sobre : ne pas répéter
      // les grandes façades vitrées de bureaux sur chaque immeuble.
      const office=category==='commercial';
      const centers=office?[52,128,204]:category==='residential'?[48,128,208]:[57,199];
      for(const center of centers){
        const width=office?42:35;
        const x=center-width/2;
        const top=office?63:67, h=office?119:109;
        ctx.fillStyle='#ded6c7';ctx.fillRect(x-5,top-8,width+10,h+13);
        ctx.fillStyle=office?'#354a56':'#3b4951';
        ctx.fillRect(x,top,width,h);
        ctx.fillStyle=office?'#6c8793':'#718991';
        ctx.fillRect(x+3,top+4,width-6,h-8);
        ctx.fillStyle='rgba(239,244,236,.22)';
        ctx.fillRect(x+5,top+5,width*.20,h*.45);
        ctx.fillStyle='#dedacf';ctx.fillRect(center-1,top,2,h);
        ctx.fillRect(x,top+h*.53,width,2);
        if(!office){
          ctx.fillStyle='#55534e';
          ctx.fillRect(x-5,top+h-15,width+10,2);
          for(let n=0;n<5;n++)ctx.fillRect(x+n*(width-1)/4,top+h-13,1,10);
        }
        ctx.fillStyle='#ece3d4';ctx.fillRect(x-8,top-11,width+16,3);
      }
    }
    ctx.fillStyle = category==='commercial'?'#bac2c1':'#b6a894';
    ctx.fillRect(0,224,256,11);
    ctx.fillStyle = '#f0e9db';
    ctx.fillRect(0,237,256,5);
    ctx.fillStyle = '#b5ad9f';
    ctx.fillRect(0,250,256,5);
  }
  ctx.restore();
  img.update(false);
  img.wrapU=Texture.WRAP_ADDRESSMODE;
  img.wrapV=Texture.WRAP_ADDRESSMODE;
  img.hasAlpha=false;
  return img;
}

export function createFacadeTextures(scene: Scene): Record<SurfaceCategory, DynamicTexture> {
  const all:SurfaceCategory[]=[
    'residential','commercial','religious','neutral','roof',
    ...WALL_SURFACES,...ROOF_SURFACES
  ];
  const textures={} as Record<SurfaceCategory,DynamicTexture>;
  for(const key of all)textures[key]=texture(scene,key);
  return textures;
}
