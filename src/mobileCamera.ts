import { ArcRotateCamera, Scene, Vector3 } from '@babylonjs/core';
import { clamp } from './geo';

type Pointer = { x: number; y: number };
export class MobileCamera {
  readonly camera: ArcRotateCamera;
  private pointers = new Map<number, Pointer>();
  private center: Pointer | null = null;
  private distance = 0;
  private angle = 0;
  private tapStart: { x: number; y: number; time: number } | null = null;
  private multi = false;
  onTap: (x: number, y: number) => void = () => {};

  constructor(scene: Scene, private canvas: HTMLCanvasElement) {
    this.camera = new ArcRotateCamera('camera', -Math.PI / 2, 0.84, 1250, Vector3.Zero(), scene);
    this.camera.inputs.clear();
    this.camera.lowerRadiusLimit = 30;
    this.camera.upperRadiusLimit = 4000;
    this.canvas.style.touchAction = 'none';
    this.canvas.addEventListener('pointerdown', this.onDown);
    this.canvas.addEventListener('pointermove', this.onMove);
    this.canvas.addEventListener('pointerup', this.onUp);
    this.canvas.addEventListener('pointercancel', this.onUp);
    this.canvas.addEventListener('wheel', e => { e.preventDefault(); this.zoom(Math.exp(e.deltaY * 0.001)); }, { passive: false });
    scene.activeCamera = this.camera;
  }

  zoom(factor: number) { this.camera.radius = clamp(this.camera.radius * factor, 30, 4000); }
  recenter() { this.camera.target.set(0, 0, 0); this.camera.alpha = -Math.PI / 2; this.camera.beta = 0.84; this.camera.radius = 1250; }
  north() { this.camera.alpha = -Math.PI / 2; }

  private onDown = (e: PointerEvent) => {
    this.canvas.setPointerCapture(e.pointerId);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) { this.multi = false; this.tapStart = { x: e.clientX, y: e.clientY, time: performance.now() }; }
    else { this.multi = true; this.tapStart = null; }
    this.snapshot();
  };
  private onMove = (e: PointerEvent) => {
    const previous = this.pointers.get(e.pointerId);
    if (!previous) return;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 1) { this.pan(e.clientX - previous.x, e.clientY - previous.y); return; }
    const [a, b] = [...this.pointers.values()];
    const nextCenter = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    const nextDistance = Math.hypot(a.x - b.x, a.y - b.y);
    const nextAngle = Math.atan2(b.y - a.y, b.x - a.x);
    if (this.center && this.distance) {
      const dx = nextCenter.x - this.center.x, dy = nextCenter.y - this.center.y;
      this.pan(dx, dy);
      this.zoom(clamp(this.distance / Math.max(10, nextDistance), 0.8, 1.25));
      let delta = nextAngle - this.angle;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      this.camera.alpha -= delta;
      this.camera.beta = clamp(this.camera.beta + dy * 0.002, 0.15, 1.5);
    }
    this.center = nextCenter; this.distance = nextDistance; this.angle = nextAngle;
  };
  private onUp = (e: PointerEvent) => {
    if (this.tapStart && !this.multi && this.pointers.size === 1) {
      const d = Math.hypot(e.clientX - this.tapStart.x, e.clientY - this.tapStart.y);
      if (d < 10 && performance.now() - this.tapStart.time < 500) {
        const rect = this.canvas.getBoundingClientRect();
        this.onTap(e.clientX - rect.left, e.clientY - rect.top);
      }
    }
    this.pointers.delete(e.pointerId); this.tapStart = null; this.snapshot();
  };
  private snapshot() {
    if (this.pointers.size < 2) { this.center = null; this.distance = 0; return; }
    const [a, b] = [...this.pointers.values()];
    this.center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
    this.distance = Math.hypot(a.x - b.x, a.y - b.y);
    this.angle = Math.atan2(b.y - a.y, b.x - a.x);
  }
  private pan(dx: number, dy: number) {
    const s = Math.max(0.04, this.camera.radius / Math.max(200, this.canvas.clientHeight || 600) * 0.9);
    const alpha = this.camera.alpha;
    const rx = -Math.sin(alpha), rz = Math.cos(alpha);
    const nx = -Math.cos(alpha), nz = -Math.sin(alpha);
    this.camera.target.x += (-dx * rx + dy * nx) * s;
    this.camera.target.z += (-dx * rz + dy * nz) * s;
  }
}
