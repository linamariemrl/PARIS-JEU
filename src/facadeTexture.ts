import { DynamicTexture, Scene, Texture } from '@babylonjs/core';

/** Habillages procéduraux par fonction IGN, non par date de construction.
 * Le revêtement matériel précis et le style historique individuel ne sont
 * pas présents dans la BD TOPO. On ne les invente pas dans les métadonnées.
 */
export type FacadeCategory = 'residential' | 'commercial' | 'religious' | 'neutral';
export type SurfaceCategory = FacadeCategory | 'roof';

function texture(scene: Scene, category: SurfaceCategory): DynamicTexture {
  const img = new DynamicTexture('revetement-' + category,
    { width: 256, height: 256 }, scene, true);
  const ctx = img.getContext() as unknown as CanvasRenderingContext2D;
  ctx.save();
  ctx.clearRect(0,0,256,256);
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

    if (category === 'religious') {
      // Fenêtres hautes à arc stylisé pour les édifices d'usage religieux.
      for (const center of [54, 128, 202]) {
        ctx.fillStyle='#b1a48f';
        ctx.fillRect(center-20,37,40,183);
        ctx.beginPath();ctx.arc(center,47,20,Math.PI,0);ctx.fill();
        ctx.fillStyle='#485962';
        ctx.fillRect(center-13,56,26,150);
        ctx.beginPath();ctx.arc(center,56,13,Math.PI,0);ctx.fill();
        ctx.fillStyle='#adbcc3';ctx.fillRect(center-1,55,2,148);
      }
    } else {
      const business = category === 'commercial';
      const neutral = category === 'neutral';
      const centers=business?[61,189]:neutral?[64,192]:[51,128,205];
      for (const c of centers) {
        const width=business?88:neutral?54:49;
        const x=c-width/2;
        const top=business?25:42;
        const height=business?186:156;
        ctx.fillStyle= business?'#aebbc0':'#c7b6a1';
        ctx.fillRect(x-5,top-6,width+10,height+11);
        ctx.fillStyle=business?'#4f6b7b':'#3d4f59';
        ctx.fillRect(x,top,width,height);
        ctx.fillStyle=business?'#7399a9':'#7b9ba6';
        ctx.fillRect(x+4,top+4,width-8,height-9);
        ctx.fillStyle='#e3e1d6';
        ctx.fillRect(c-2,top,4,height);
        ctx.fillRect(x,top+height*0.51,width,4);
        ctx.fillStyle='#9dafb1';
        ctx.fillRect(x+5,top+7,Math.max(6,width*0.26),height*0.34);
        if (!business) {
          // Garde-corps inspirés du bâti parisien ; non géolocalisés au détail.
          ctx.fillStyle='#4c4a47';
          ctx.fillRect(x-7,top+height-42,width+14,4);
          for (let b=0;b<6;b++)ctx.fillRect(x-4+b*(width+8)/6,top+height-40,2,19);
          ctx.fillStyle='#b6a997';
          ctx.fillRect(x-10,top+height-22,width+20,7);
        }
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
  return {
    residential:texture(scene,'residential'),
    commercial:texture(scene,'commercial'),
    religious:texture(scene,'religious'),
    neutral:texture(scene,'neutral'),
    roof:texture(scene,'roof'),
  };
}
