import {
  Color3, Mesh, Scene, StandardMaterial, VertexData
} from '@babylonjs/core';
import earcut from 'earcut';
import {terrainHeight} from './terrain';
import {stableFoundation} from './reliefAnchors';

/** Tablier et parapets 3D très simplifiés à partir des emprises IGN des
 * tronçons surélevés. L'élévation est illustrative : elle ne restitue
 * pas le profil altimétrique réel des ponts de Paris.
 */
type Point = [number, number];
type Polygon = Point[][];
type Layer = Polygon[];
type XYZ = [number, number, number];

const DECK_TOP = 2.25;
const DECK_BOTTOM = 0.25;
const RAIL_TOP = 3.35;
const RAIL_THICKNESS = 0.35;

class Batch {
  positions: number[] = [];
  indices: number[] = [];
  referenceY = 0;
  add(a: XYZ, b: XYZ, c: XYZ) {
    const index = this.positions.length / 3;
    // Un tablier rigide ne doit jamais suivre les variations de la grille
    // altimétrique de rive sommet par sommet (origine des grandes pointes).
    for(const p of [a,b,c])
      this.positions.push(p[0],p[1]+this.referenceY,p[2]);
    this.indices.push(index, index + 1, index + 2);
  }
  quad(a: XYZ, b: XYZ, c: XYZ, d: XYZ) {
    this.add(a, b, c);
    this.add(a, c, d);
  }
}
function openRing(ring: Point[]): Point[] {
  if (ring.length < 3) return [];
  const pts = ring.slice();
  const first = pts[0], last = pts[pts.length - 1];
  if (Math.hypot(first[0] - last[0], first[1] - last[1]) < 0.01) pts.pop();
  return pts;
}
function geometry(scene: Scene, name: string, batch: Batch, color: Color3): Mesh | null {
  if (!batch.indices.length) return null;
  const mesh = new Mesh(name, scene);
  const data = new VertexData();
  data.positions = batch.positions;
  data.indices = batch.indices;
  const normals: number[] = [];
  VertexData.ComputeNormals(batch.positions, batch.indices, normals);
  data.normals = normals;
  data.applyToMesh(mesh);
  const mat = new StandardMaterial(name + '-mat', scene);
  mat.diffuseColor = color;
  mat.specularColor = Color3.Black();
  mat.backFaceCulling = false;
  mesh.material = mat;
  mesh.isPickable = false;
  mesh.freezeWorldMatrix();
  return mesh;
}
function addBeam(batch: Batch, a: Point, b: Point) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const length = Math.hypot(dx, dz);
  if (length < 7 || length > 230) return;
  const nx = -dz / length * RAIL_THICKNESS / 2;
  const nz = dx / length * RAIL_THICKNESS / 2;
  const p: XYZ = [a[0] + nx, DECK_TOP, a[1] + nz];
  const q: XYZ = [b[0] + nx, DECK_TOP, b[1] + nz];
  const r: XYZ = [b[0] - nx, DECK_TOP, b[1] - nz];
  const s: XYZ = [a[0] - nx, DECK_TOP, a[1] - nz];
  const pt: XYZ = [p[0], RAIL_TOP, p[2]];
  const qt: XYZ = [q[0], RAIL_TOP, q[2]];
  const rt: XYZ = [r[0], RAIL_TOP, r[2]];
  const st: XYZ = [s[0], RAIL_TOP, s[2]];
  batch.quad(pt, qt, rt, st);
  batch.quad(p, q, qt, pt);
  batch.quad(r, s, st, rt);
  batch.quad(s, p, pt, st);
  batch.quad(q, r, rt, qt);
}
export function addBridges(scene: Scene, polygons: Layer): number {
  const deck = new Batch(), parapets = new Batch();
  let count = 0;
  for (const polygon of polygons) {
    if (!Array.isArray(polygon) || !polygon.length) continue;
    const flat: number[] = [], holes: number[] = [];
    let countPoints = 0;
    const rings: Point[][] = [];
    for (const ring of polygon) {
      const pts = openRing(ring);
      if (pts.length < 3) continue;
      if (countPoints > 0) holes.push(countPoints);
      rings.push(pts);
      for (const [x, z] of pts) { flat.push(x, z); countPoints++; }
    }
    if (countPoints < 3) continue;
    // Assise commune par pont : les parapets et le tablier restent solidaires.
    const reference=stableFoundation(
      rings[0].map(([x,z])=>({x,z})),terrainHeight);
    deck.referenceY=reference;
    parapets.referenceY=reference;
    const tri = earcut(flat, holes, 2);
    if (!tri.length) continue;
    count++;
    for (let i = 0; i < tri.length; i += 3) {
      const at = tri[i] * 2, bt = tri[i+1] * 2, ct = tri[i+2] * 2;
      deck.add([flat[at], DECK_TOP, flat[at+1]],
               [flat[bt], DECK_TOP, flat[bt+1]],
               [flat[ct], DECK_TOP, flat[ct+1]]);
    }
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i], b = ring[(i+1) % ring.length];
        deck.quad(
          [a[0], DECK_BOTTOM, a[1]], [b[0], DECK_BOTTOM, b[1]],
          [b[0], DECK_TOP, b[1]], [a[0], DECK_TOP, a[1]]
        );
      }
    }
    // Sur les deux rives principales du tablier seulement : on évite
    // de barrer les accès d'un pont par un parapet transversal.
    const exterior = rings[0];
    if (!exterior) continue;
    let dominantDx = 1, dominantDz = 0, longest = 0;
    for (let i = 0; i < exterior.length; i++) {
      const a = exterior[i], b = exterior[(i+1) % exterior.length];
      const dx = b[0]-a[0], dz = b[1]-a[1];
      const length = Math.hypot(dx, dz);
      if (length > longest) { longest = length; dominantDx = dx / length; dominantDz = dz / length; }
    }
    if (longest < 7) continue;
    for (let i = 0; i < exterior.length; i++) {
      const a = exterior[i], b = exterior[(i+1) % exterior.length];
      const dx = b[0]-a[0], dz = b[1]-a[1];
      const length = Math.hypot(dx, dz);
      if (length < 7) continue;
      const parallel = Math.abs((dx*dominantDx + dz*dominantDz)/length);
      if (parallel >= 0.83) addBeam(parapets, a, b);
    }
  }
  geometry(scene, 'tabliers-ponts-3D', deck, new Color3(.79,.79,.79));
  geometry(scene, 'parapets-ponts-3D', parapets, new Color3(.90,.90,.90));
  return count;
}
