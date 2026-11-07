import { Engine, Matrix, Scene, Vector3 } from '@babylonjs/core';

interface StreetLabel {
  id: string;
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

/** Noms des voies du 4e toujours affichés. La caméra ne change pas les données.
 * Texte léger dessiné dans un canvas au-dessus de la carte.
 * L'encombrement à l'échelle générale reste inévitable, sans cacher de rues.
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
      data.namedStreets.toLocaleString('fr-FR') + ' voies nommées';
  }

  update(cameraRadius: number): void {
    const now = performance.now();
    if (now - this.lastFrame < 160) return;
    this.lastFrame = now;

    const width = this.canvas.clientWidth;
    const height = this.canvas.clientHeight;
    if (!width || !height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 1.8);
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
    const camera = this.scene.activeCamera;
    if (!camera || !this.entries.length) return;
    const renderWidth = this.engine.getRenderWidth();
    const renderHeight = this.engine.getRenderHeight();
    const viewport = camera.viewport.toGlobal(renderWidth, renderHeight);
    const transform = this.scene.getTransformMatrix();
    const identity = Matrix.Identity();
    const fontSize = cameraRadius > 1800 ? 9 : cameraRadius > 850 ? 10 : 11;
    ctx.font = `600 ${fontSize}px system-ui,Arial,sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    for (const street of this.entries) {
      const base = Vector3.Project(
        new Vector3(street.x, 0.6, street.z), identity, transform, viewport
      );
      if (base.z < 0 || base.z > 1 || !Number.isFinite(base.x)) continue;
      const x = base.x * width / renderWidth;
      const y = base.y * height / renderHeight;
      if (x < -170 || y < -20 || x > width + 170 || y > height + 20) continue;
      let theta = 0;
      const radians = street.angle * Math.PI / 180;
      const dx = Math.cos(radians) * 10;
      const dz = Math.sin(radians) * 10;
      const edge = Vector3.Project(
        new Vector3(street.x + dx, 0.6, street.z + dz),
        identity, transform, viewport
      );
      theta = Math.atan2(
        (edge.y - base.y) * height / renderHeight,
        (edge.x - base.x) * width / renderWidth
      );
      if (theta > Math.PI/2) theta -= Math.PI;
      if (theta < -Math.PI/2) theta += Math.PI;
      if (!Number.isFinite(theta)) theta = 0;

      ctx.save();
      ctx.translate(x,y);
      ctx.rotate(theta);
      // Contraste discret quel que soit le revêtement, sans cartouche opaque.
      ctx.globalAlpha = cameraRadius > 1600 ? 0.75 : 0.90;
      ctx.strokeStyle = 'rgba(238,233,218,.93)';
      ctx.lineWidth = 2.5;
      ctx.strokeText(street.name,0,0);
      ctx.fillStyle = '#263944';
      ctx.fillText(street.name,0,0);
      ctx.restore();
    }
  }
}
