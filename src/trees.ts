import {
  Color3, Matrix, Mesh, MeshBuilder, Quaternion,
  Scene, StandardMaterial, Vector3,
} from '@babylonjs/core';

/** Arbres réels Paris Data ; géométrie végétale stylisée, instanciée en GPU.
 * Une instance n'est pas un relevé précis de couronne ou de tronc.
 */
interface TreeRecord {
  id: string;
  x: number;
  z: number;
  h: number;
  estimated: boolean;
  genre: string;
  domain: string;
  circumference: number;
}
interface TreesJson {
  schema: number;
  source: string;
  count: number;
  trees: TreeRecord[];
}
export type QualityLevel = 'low' | 'medium' | 'high';

const evergreen = new Set(['pinus', 'picea', 'cedrus', 'abies', 'taxus', 'thuja', 'cupressus']);
const qIdentity = Quaternion.Identity();

function material(scene: Scene, name: string, rgb: [number, number, number]): StandardMaterial {
  const mat = new StandardMaterial(name, scene);
  mat.diffuseColor = new Color3(...rgb);
  mat.specularColor = new Color3(0.025, 0.035, 0.018);
  mat.backFaceCulling = true;
  return mat;
}
function matrix(x: number, y: number, z: number, sx: number, sy: number, sz: number): number[] {
  return Array.from(Matrix.Compose(new Vector3(sx, sy, sz), qIdentity, new Vector3(x, y, z)).toArray());
}
function hash(s: string): number {
  let h = 2166136261;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h >>> 0;
}
function installInstances(mesh: Mesh, matrices: number[]) {
  mesh.thinInstanceSetBuffer('matrix', new Float32Array(matrices), 16, true);
  mesh.thinInstanceRefreshBoundingInfo();
  mesh.isPickable = false;
}
export class TreeLayer {
  private quality: QualityLevel = 'medium';
  private trees: TreeRecord[] = [];
  private trunks: Mesh;
  private crowns: Mesh;
  private conifers: Mesh;
  private loaded = false;
  private x = 0;
  private z = 0;
  private previousX = Number.POSITIVE_INFINITY;
  private previousZ = Number.POSITIVE_INFINITY;
  private onStatus: (text: string) => void;

  constructor(scene: Scene, onStatus: (text: string) => void) {
    this.onStatus = onStatus;
    this.trunks = MeshBuilder.CreateCylinder('arbres-troncs', {
      height: 1, diameter: 1, tessellation: 5
    }, scene);
    this.trunks.material = material(scene, 'écorce', [0.39, 0.32, 0.25]);
    this.crowns = MeshBuilder.CreateSphere('arbres-feuillus', {
      diameter: 2, segments: 5
    }, scene);
    this.crowns.material = material(scene, 'feuillage', [0.25, 0.43, 0.28]);
    this.conifers = MeshBuilder.CreateCylinder('arbres-persistants', {
      height: 2, diameterBottom: 2, diameterTop: 0.02, tessellation: 7
    }, scene);
    this.conifers.material = material(scene, 'conifères', [0.18, 0.32, 0.26]);
    for (const mesh of [this.trunks, this.crowns, this.conifers]) {
      mesh.isPickable = false;
      mesh.setEnabled(false);
    }
  }

  async init() {
    const url = import.meta.env.BASE_URL + 'data/4e/trees.json';
    const response = await fetch(url);
    if (!response.ok) {
      this.onStatus('Arbres : données municipales absentes');
      return;
    }
    const parsed = await response.json() as TreesJson;
    if (parsed.schema !== 1 || !Array.isArray(parsed.trees) || parsed.trees.length < 100) {
      throw new Error('Données des arbres invalides');
    }
    this.trees = parsed.trees.filter(t =>
      Number.isFinite(t.x) && Number.isFinite(t.z) &&
      Number.isFinite(t.h) && t.h >= 2 && t.h <= 38
    );
    this.loaded = true;
    this.render();
  }

  setQuality(q: QualityLevel) {
    this.quality = q;
    if (this.loaded) this.render();
  }

  update(x: number, z: number) {
    if (!this.loaded) return;
    if (Math.hypot(x-this.previousX, z-this.previousZ) < 110) return;
    this.x = x;
    this.z = z;
    this.render();
  }

  private render() {
    this.previousX = this.x;
    this.previousZ = this.z;
    const radius = this.quality === 'low' ? 520 :
                   this.quality === 'medium' ? 720 : 1000;
    const radiusSquared = radius * radius;
    const keep = this.quality === 'low' ? 0.28 :
                 this.quality === 'medium' ? 0.60 : 1;
    const trunks: number[] = [];
    const crowns: number[] = [];
    const conifers: number[] = [];
    let shown = 0;
    for (const tree of this.trees) {
      const dx = tree.x - this.x, dz = tree.z - this.z;
      if (dx*dx + dz*dz > radiusSquared) continue;
      if ((hash(tree.id) % 1000) / 1000 >= keep) continue;
      const h = tree.h;
      const trunkH = h * 0.46;
      const diameter = tree.circumference > 0 ?
        Math.min(1.2, Math.max(0.17, tree.circumference / (Math.PI * 100))) :
        Math.max(0.18, Math.min(0.65, h * 0.042));
      const radius = Math.max(1, Math.min(4.8, h * 0.27));
      trunks.push(...matrix(tree.x, trunkH / 2, tree.z, diameter, trunkH, diameter));
      if (evergreen.has((tree.genre || '').trim().toLowerCase())) {
        conifers.push(...matrix(tree.x, h * 0.66, tree.z, radius, h * 0.34, radius));
      } else {
        crowns.push(...matrix(tree.x, h * 0.74, tree.z, radius, h * 0.28, radius));
      }
      shown++;
    }
    for (const [mesh, matrices] of [
      [this.trunks, trunks], [this.crowns, crowns], [this.conifers, conifers],
    ] as [Mesh, number[]][]) {
      mesh.setEnabled(matrices.length > 0);
      installInstances(mesh, matrices);
    }
    this.onStatus(shown.toLocaleString('fr-FR') + ' arbres');
  }
}
