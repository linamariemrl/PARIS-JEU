/** Gestes d'une carte tactile.
 * Les mouvements ne dépendent pas du signe approximatif de la caméra :
 * le point du terrain saisi reste sous le doigt à chaque translation.
 */
export function wrapTwist(delta: number): number {
  if (!Number.isFinite(delta)) return 0;
  while (delta > Math.PI) delta-=Math.PI*2;
  while (delta < -Math.PI) delta+=Math.PI*2;
  return delta;
}
export function rotateWithFingers(alpha: number, previous: number, next: number): number {
  return alpha+wrapTwist(next-previous);
}
export function tiltWithFingers(beta: number, displacementY: number): number {
  // Deux doigts vers le haut : horizon davantage visible.
  return Math.max(0.18,Math.min(1.43,beta-displacementY*.0024));
}
export function zoomAroundPinch(radius: number, previousDistance: number, nextDistance: number): number {
  if (previousDistance<=0||nextDistance<=0) return radius;
  const factor=Math.max(.75,Math.min(1.35,previousDistance/nextDistance));
  return Math.max(30,Math.min(4000,radius*factor));
}
