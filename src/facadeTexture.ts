import { DynamicTexture, Scene, Texture } from '@babylonjs/core';

/** Dessin original d'une façade stylisée.
 * Le motif est illustratif : les années de construction des bâtiments ne
 * sont pas encore renseignées individuellement.
 */
export function createFacadeTexture(scene: Scene): DynamicTexture {
  const texture = new DynamicTexture('facades-paris-texture', { width: 256, height: 256 }, scene, true);
  const ctx = texture.getContext() as unknown as CanvasRenderingContext2D;
  // Teinte presque blanche, multipliée par la couleur propre à chaque bâtiment.
  ctx.fillStyle = '#fffdf9';
  ctx.fillRect(0, 0, 256, 256);

  // Assises de pierre, corniches, encadrements et fenêtres.
  ctx.fillStyle = '#e4ded3';
  ctx.fillRect(0, 2, 256, 7);
  ctx.fillStyle = '#dad5c9';
  ctx.fillRect(0, 239, 256, 12);
  ctx.fillStyle = '#f6f0e8';
  ctx.fillRect(0, 232, 256, 5);
  for (let x = 0; x < 256; x += 128) {
    ctx.fillStyle = '#d5d0c4';
    ctx.fillRect(x + 28, 36, 75, 160);
    ctx.fillStyle = '#faf8f2';
    ctx.fillRect(x + 34, 29, 63, 14);
    ctx.fillStyle = '#414f5c';
    ctx.fillRect(x + 36, 43, 59, 143);
    ctx.fillStyle = '#647789';
    ctx.fillRect(x + 41, 48, 49, 130);
    ctx.fillStyle = '#a3b3b9';
    ctx.fillRect(x + 43, 50, 16, 49);
    ctx.fillRect(x + 65, 100, 23, 70);
    ctx.fillStyle = '#e5e5df';
    ctx.fillRect(x + 63, 43, 6, 143);
    ctx.fillRect(x + 36, 112, 59, 5);
    ctx.fillStyle = '#e6dfd3';
    ctx.fillRect(x + 21, 185, 90, 9);
    ctx.fillStyle = '#c5bfb5';
    ctx.fillRect(x + 17, 198, 98, 7);
    // Garde-corps fins, peu de triangles supplémentaires.
    ctx.fillStyle = '#3f4444';
    ctx.fillRect(x + 25, 158, 81, 3);
    for (let j = 0; j <= 7; j++) ctx.fillRect(x + 27 + j * 11, 159, 2, 18);
  }
  texture.update(false);
  texture.wrapU = Texture.WRAP_ADDRESSMODE;
  texture.wrapV = Texture.WRAP_ADDRESSMODE;
  texture.hasAlpha = false;
  return texture;
}
