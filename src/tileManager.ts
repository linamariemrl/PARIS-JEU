import type { Mesh, Scene, StandardMaterial } from '@babylonjs/core';
import { createTile } from './buildings';
import type { Manifest, TileFile, TileInfo } from './types';

const root = import.meta.env.BASE_URL + 'data/4e/';
interface Loaded { meshes: Mesh[]; count: number; }

export class TileManager {
  private manifest: Manifest | null = null;
  private active = new Map<string, Loaded>();
  private pending = new Map<string, AbortController>();
  private failed = new Set<string>();
  private lastRefresh = 0;
  private quality: 'low' | 'medium' | 'high' = 'medium';

  constructor(
    private scene: Scene,
    private material: StandardMaterial,
    private onStatus: (message: string, count: number) => void
  ) {}

  async init() {
    const response = await fetch(root + 'manifest.json');
    if (!response.ok) throw new Error('Données IGN absentes. Exécutez « Préparer les données IGN » dans GitHub Actions.');
    const manifest = await response.json() as Manifest;
    if (manifest.schema !== 1 || !Array.isArray(manifest.tiles) || !manifest.tiles.length) {
      throw new Error('Fichier manifeste IGN absent ou invalide.');
    }
    this.manifest = manifest;
    this.refresh(0, 0);
  }
  setQuality(q: 'low' | 'medium' | 'high') {
    this.quality = q;
    this.lastRefresh = 0;
  }
  update(x: number, z: number) {
    if (!this.manifest || performance.now() - this.lastRefresh < 550) return;
    this.refresh(x, z);
  }
  private refresh(x: number, z: number) {
    this.lastRefresh = performance.now();
    if (!this.manifest) return;
    const radius = this.quality === 'low' ? 630 : this.quality === 'medium' ? 840 : 1170;
    const tileSize = this.manifest.tileMeters;
    const distance = (tile: TileInfo) => {
      const dx = tile.ix * tileSize + tileSize / 2 - x;
      const dz = tile.iz * tileSize + tileSize / 2 - z;
      return dx * dx + dz * dz;
    };
    const needed = this.manifest.tiles.filter(tile => distance(tile) < radius * radius).sort((a,b) => distance(a) - distance(b));
    const neededIds = new Set(needed.map(t => t.id));
    for (const [id, loaded] of this.active) {
      if (!neededIds.has(id)) {
        loaded.meshes.forEach(mesh => mesh.dispose());
        this.active.delete(id);
      }
    }
    for (const [id, controller] of this.pending) {
      if (!neededIds.has(id)) { controller.abort(); this.pending.delete(id); }
    }
    const slots = Math.max(0, 3 - this.pending.size);
    for (const tile of needed.filter(t => !this.active.has(t.id) && !this.pending.has(t.id) && !this.failed.has(t.id)).slice(0, slots)) {
      void this.load(tile);
    }
    this.report();
  }
  private async load(tile: TileInfo) {
    const controller = new AbortController();
    this.pending.set(tile.id, controller);
    try {
      const response = await fetch(root + 'tiles/' + tile.id + '.json', {signal: controller.signal});
      if (!response.ok) throw new Error('Tuile indisponible : ' + tile.id);
      const data = await response.json() as TileFile;
      if (data.schema !== 1 || !Array.isArray(data.buildings)) throw new Error('Format de tuile invalide');
      if (!controller.signal.aborted) {
        this.active.set(tile.id, { meshes: createTile(this.scene, data, this.material), count: data.buildings.length });
      }
    } catch (e) {
      if (!controller.signal.aborted) { this.failed.add(tile.id); console.warn('Tuile IGN', tile.id, e); }
    } finally {
      this.pending.delete(tile.id);
      this.lastRefresh = 0;
      this.report();
    }
  }
  private report() {
    const count = [...this.active.values()].reduce((s, t) => s + t.count, 0);
    const state = this.failed.size ? this.failed.size + ' tuile(s) indisponible(s)' :
      this.pending.size ? 'Chargement des bâtiments IGN...' : 'Données IGN BD TOPO';
    this.onStatus(state, count);
  }
}
