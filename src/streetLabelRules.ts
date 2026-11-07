/** Règles d'affichage sans réglage utilisateur, fixes en pixels CSS.
 * Aucun nom n'est rendu en vue d'ensemble ; l'inventaire reste complet.
 */
export const STREET_NAME_FONT_PX = 9;
export const STREET_LABEL_LIMIT = 28;
export const STREET_LABEL_MAX_RADIUS = 720;
export function labelVisibility(radius: number, groundDistance: number): number {
  if (!Number.isFinite(radius) || !Number.isFinite(groundDistance) ||
      radius >= STREET_LABEL_MAX_RADIUS || groundDistance < 0) return 0;
  const zoom = Math.min(1, Math.max(0, (STREET_LABEL_MAX_RADIUS - radius) / 180));
  const limit = Math.min(370, 180 + radius * 0.32);
  const near = Math.min(1, Math.max(0, (limit - groundDistance) / 90));
  return zoom * near;
}
export interface LabelRect { left: number; right: number; top: number; bottom: number; }
export function collides(rect: LabelRect, drawn: LabelRect[]): boolean {
  return drawn.some(other =>
    rect.left < other.right+4 && rect.right+4 > other.left &&
    rect.top < other.bottom+4 && rect.bottom+4 > other.top
  );
}
