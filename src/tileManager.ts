import type { Mesh, Scene } from '@babylonjs/core';
import { createTile } from './buildings';
import type { Manifest, TileFile, TileInfo } from './types';

const root = import.meta.env.BASE_URL + 'data/4e/';
interface Loaded { meshes: Mesh[]; count: number; }

/**
 * Mode pilote 4e : les 27 tuiles de bâtiments sont conservées en mémoire.
 * Le zoom, le niveau de qualité et la position de la caméra ne changent
 * JAMAIS le nombre de bâtiments présents dans la scène.
 * À l'échelle de Paris entier, cette règle sera conservée via des LOD
 * géométriques et des représentations de loin, pas par disparition de tuiles.
 */
export class TileManager {
  private manifest: Manifest | null = null;
  private active = new Map<string, Loaded>();
  private failed = new Set<string>();
  private ready = false;

  constructor(
    private scene: Scene,
    private materials: ReturnType<typeof import('./buildings').createMaterials>,
    private onStatus: (message: string, count: number) => void
  ) {}

  async init() {
    const response = await fetch(root + 'manifest.json');
    if (!response.ok) throw new Error('Manifeste des bâtiments IGN indisponible.');
    const manifest = await response.json() as Manifest;
    if (manifest.schema !== 1 || !Array.isArray(manifest.tiles) || !manifest.tiles.length) {
      throw new Error('Manifeste IGN invalide.');
    }
    this.manifest = manifest;
    // Jusqu'à trois téléchargements simultanés sans saturation du téléphone.
    const queue = manifest.tiles.slice();
    const worker = async () => {
      while (queue.length) {
        const info = queue.shift();
        if (!info) break;
        await this.load(info);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    this.ready = this.failed.size === 0 && this.active.size === manifest.tiles.length;
    this.report();
  }

  // L'échelle graphique peut changer, mais jamais la présence des bâtiments.
  setQuality(_quality: 'low' | 'medium' | 'high') {}
  update(_x: number, _z: number) {}

  private async load(tile: TileInfo) {
    try {
      const response = await fetch(root + 'tiles/' + tile.id + '.json');
      if (!response.ok) throw new Error('Tuile indisponible : ' + tile.id);
      const data = await response.json() as TileFile;
      if (data.schema !== 1 || !Array.isArray(data.buildings) || data.buildings.length !== tile.count) {
        throw new Error('Tuile IGN invalide : ' + tile.id);
      }
      this.active.set(tile.id, {
        meshes: createTile(this.scene, data, this.materials),
        count: data.buildings.length,
      });
    } catch (e) {
      this.failed.add(tile.id);
      console.warn('Tuile des bâtiments', tile.id, e);
    }
    this.report();
  }

  private report() {
    const count = [...this.active.values()].reduce((n, v) => n + v.count, 0);
    const expected = this.manifest?.buildings ?? 0;
    let status = this.failed.size ? this.failed.size + ' tuile(s) IGN indisponibles' :
      this.ready ? 'Tous les bâtiments du 4e chargés' : 'Chargement intégral des bâtiments IGN…';
    if (expected && !this.ready && !this.failed.size) {
      status += ' ' + count.toLocaleString('fr-FR') + '/' + expected.toLocaleString('fr-FR');
    }
    this.onStatus(status, count);
  }
}
