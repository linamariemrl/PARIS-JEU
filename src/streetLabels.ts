import { Engine, Matrix, Scene, Vector3 } from '@babylonjs/core';
import {
  collides, labelVisibility, STREET_LABEL_LIMIT,
  STREET_LABEL_MAX_RADIUS, STREET_NAME_FONT_PX,
  type LabelRect
} from './streetLabelRules';

interface StreetLabel {
  id: string;
  streetId?: string;
  name: string;
  x: number;
  z: number;
  angle: number;
  kind: string;
  length: number;
}
interface StreetPayload {
  schema: number;
  namedStreets: number;
  labels: StreetLabel[];
}

/** Les noms s'affichent seulement au voisinage immédiat de la voie.
 * Texte fixe, à 9 px CSS, légèrement transparent et sans fond opaque.
 * Les ancres réelles sont répétées sur les longues voies, mais jamais
 * étirées par le zoom. Le désencombrement est uniquement visuel :
 * il ne supprime aucune voie du référentiel.
 */
export class StreetLabels {
  private entries: StreetLabel[] = [];
  private lastFrame = 0;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private lastWidth = 0;
  private lastHeight = 0;

  constructor(private scene: Scene, private engine: Engine) {
    const canvas = document.getElementById('street-labels');
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error('Calque des noms de rues introuvable');
    }
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) throw new Error('Affichage des noms de rues indisponible');
    this.ctx = ctx;
  }

  async init(): Promise<void> {
    const response = await fetch(import.meta.env.BASE_URL + 'data/4e/street-names.json');
    if (!response.ok) throw new Error('Référentiel officiel des noms de rues indisponible');
    const data = await response.json() as StreetPayload;
    if (data.schema !== 1 || !Array.isArray(data.labels) || !data.labels.length) {
      throw new Error('Référentiel des voies invalide');
    }
    this.entries = data.labels.filter(t =>
      Boolean(t.name) && Number.isFinite(t.x) && Number.isFinite(t.z)
    );
    const status = document.getElementById('streets');
    if (status) status.textContent =
      data.namedStreets.toLocaleString('fr-FR') + ' voies référencées';
  }

  update(cameraRadius: number, targetX: number, targetZ: number): void {
    const now = performance.now();
    if (now - this.lastFrame < 240) return;
    this.lastFrame = now;

    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.6);
    const bufferWidth = Math.round(width * ratio);
    const bufferHeight = Math.round(height * ratio);
    if (this.lastWidth !== bufferWidth || this.lastHeight !== bufferHeight) {
      this.canvas.width = bufferWidth;
      this.canvas.height = bufferHeight;
      this.lastWidth = bufferWidth;
      this.lastHeight = bufferHeight;
    }
    const ctx = this.ctx;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.clearRect(0, 0, width, height);

    // La vue d'ensemble reste entièrement dégagée.
    if (cameraRadius >= STREET_LABEL_MAX_RADIUS || !this.entries.length) return;
    const camera = this.scene.activeCamera;
    if (!camera) return;

    const renderWidth = this.engine.getRenderWidth();
    const renderHeight = this.engine.getRenderHeight();
    const viewport = camera.viewport.toGlobal(renderWidth, renderHeight);
    const transform = this.scene.getTransformMatrix();
    const identity = Matrix.Identity();
    const font = '500 ' + STREET_NAME_FONT_PX + 'px system-ui,Arial,sans-serif';
    ctx.font = font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;

    const nearby = this.entries.map(street => {
      const dx = street.x-targetX, dz = street.z-targetZ;
      const distance = Math.hypot(dx,dz);
      return {street,distance,visibility:labelVisibility(cameraRadius,distance)};
    }).filter(item => item.visibility >= 0.12)
      .sort((a,b)=>a.distance-b.distance);
    const occupied: LabelRect[] = [];
    let drawn = 0;

    for (const {street,visibility} of nearby) {
      if (drawn >= STREET_LABEL_LIMIT) break;
      // 18 cm au-dessus de la chaussée, comme une annotation cartographique.
      const start = Vector3.Project(
        new Vector3(street.x, 0.18, street.z), identity, transform, viewport
      );
      if (!Number.isFinite(start.z) || start.z <= 0 || start.z >= 1) continue;
      const x = start.x * width / renderWidth;
      const y = start.y * height / renderHeight;
      // Préserver les commandes, l'horloge et le pied de l'écran.
      if (x < 15 || x > width-16 || y < 157 || y > height-77) continue;

      const radians = street.angle * Math.PI / 180;
      const dx = Math.cos(radians)*10;
      const dz = Math.sin(radians)*10;
      const end = Vector3.Project(
        new Vector3(street.x+dx,0.18,street.z+dz), identity, transform, viewport
      );
      if (end.z <= 0 || end.z >= 1) continue;
      let angle = Math.atan2(
        (end.y-start.y)*height/renderHeight,
        (end.x-start.x)*width/renderWidth
      );
      if (!Number.isFinite(angle)) continue;
      if (angle > Math.PI/2) angle -= Math.PI;
      if (angle < -Math.PI/2) angle += Math.PI;

      const textWidth = ctx.measureText(street.name).width;
      const c = Math.abs(Math.cos(angle)), s = Math.abs(Math.sin(angle));
      const halfW = (c*(textWidth+4)+s*13)/2;
      const halfH = (s*(textWidth+4)+c*13)/2;
      const rect: LabelRect = {
        left:x-halfW, right:x+halfW, top:y-halfH, bottom:y+halfH
      };
      if (rect.left < 8 || rect.right > width-84 ||
          rect.top < 152 || rect.bottom > height-55 ||
          collides(rect,occupied)) continue;

      // Une étiquette projetée en 2D ne doit pas traverser la façade
      // d'un bâtiment devant elle. Un rayon est testé uniquement sur
      // les rares étiquettes effectivement visibles et non superposées.
      // scene.pick attend les coordonnées CSS, comme la sélection tactile.
      const anchor = new Vector3(street.x, 0.18, street.z);
      const hit = this.scene.pick(
        x, y,
        mesh => mesh.isPickable && Boolean(mesh.metadata),
        false,
        camera
      );
      if (hit?.hit && hit.pickedMesh &&
          hit.distance + 0.75 < Vector3.Distance(camera.position, anchor)) {
        continue;
      }

      ctx.save();
      ctx.translate(x,y);
      ctx.rotate(angle);
      ctx.globalAlpha = .56 * visibility;
      ctx.lineWidth = 1.3;
      ctx.strokeStyle = 'rgba(245,242,231,.55)';
      ctx.strokeText(street.name,0,0);
      ctx.fillStyle = '#243440';
      ctx.fillText(street.name,0,0);
      ctx.restore();
      occupied.push(rect);
      drawn++;
    }
  }
}
