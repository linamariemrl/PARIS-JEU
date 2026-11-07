import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, VertexData, Vector3 } from '@babylonjs/core';
import earcut from 'earcut';
import { project } from './geo';
import type { Building, Point, TileFile } from './types';

type XYZ = [number, number, number];
type RGB = [number, number, number];
interface Batch { positions: number[]; indices: number[]; colors: number[]; faceToBuilding: number[]; }
const WALLS: RGB[] = [
  [0.82, 0.76, 0.66], [0.89, 0.84, 0.76], [0.76, 0.74, 0.67],
  [0.91, 0.86, 0.74], [0.74, 0.74, 0.74], [0.86, 0.79, 0.72]
];
const ROOF: RGB = [0.39, 0.48, 0.55];
const empty = (): Batch => ({ positions: [], indices: [], colors: [], faceToBuilding: [] });

function triangle(out: Batch, a: XYZ, b: XYZ, c: XYZ, rgb: RGB, id: number) {
  const start = out.positions.length / 3;
  out.positions.push(...a, ...b, ...c);
  out.indices.push(start, start + 1, start + 2);
  for (let i = 0; i < 3; i++) out.colors.push(...rgb, 1);
  out.faceToBuilding.push(id);
}
function hash(s: string): number {
  let n = 2166136261;
  for (const c of s) n = Math.imul(n ^ c.charCodeAt(0), 16777619);
  return n >>> 0;
}
function projected(ring: Point[]) {
  const out = ring.map(project);
  if (out.length > 2 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].z - out[out.length - 1].z) < 0.01) out.pop();
  return out;
}
function addBuilding(out: Batch, b: Building, featureIndex: number) {
  const h = Math.min(220, Math.max(2, b.height));
  const wall = WALLS[hash(b.id) % WALLS.length];
  for (const polygon of b.polygons) {
    const rings = polygon.map(projected).filter(x => x.length >= 3);
    if (!rings.length) continue;
    const vertices: { x: number; z: number }[] = [];
    const holes: number[] = [];
    for (let r = 0; r < rings.length; r++) {
      if (r > 0) holes.push(vertices.length);
      vertices.push(...rings[r]);
    }
    // Les murs des anneaux intérieurs sont également représentés.
    for (const ring of rings) {
      for (let j = 0; j < ring.length; j++) {
        const p = ring[j], q = ring[(j + 1) % ring.length];
        const a: XYZ = [p.x, 0, p.z], bb: XYZ = [q.x, 0, q.z];
        const c: XYZ = [q.x, h, q.z], d: XYZ = [p.x, h, p.z];
        triangle(out, a, bb, c, wall, featureIndex);
        triangle(out, a, c, d, wall, featureIndex);
      }
    }
    const flat = vertices.flatMap(p => [p.x, p.z]);
    const t = earcut(flat, holes, 2);
    for (let k = 0; k < t.length; k += 3) {
      const a = vertices[t[k]], bb = vertices[t[k + 1]], c = vertices[t[k + 2]];
      triangle(out, [a.x, h, a.z], [bb.x, h, bb.z], [c.x, h, c.z], ROOF, featureIndex);
    }
  }
}
export function createMaterials(scene: Scene) {
  const mat = new StandardMaterial('facades-et-toits', scene);
  mat.diffuseColor = Color3.White();
  mat.specularColor = new Color3(0.05, 0.05, 0.05);
  mat.backFaceCulling = false;
  return mat;
}
export function createTile(scene: Scene, tile: TileFile, material: StandardMaterial): Mesh[] {
  const out = empty();
  tile.buildings.forEach((b, i) => addBuilding(out, b, i));
  if (!out.indices.length) return [];
  const vd = new VertexData();
  vd.positions = out.positions;
  vd.indices = out.indices;
  vd.colors = out.colors;
  const normals: number[] = [];
  VertexData.ComputeNormals(out.positions, out.indices, normals);
  vd.normals = normals;
  const mesh = new Mesh('bâtiments-' + tile.id, scene);
  vd.applyToMesh(mesh);
  mesh.material = material;
  mesh.useVertexColors = true;
  mesh.isPickable = true;
  mesh.metadata = { buildings: tile.buildings, faceToBuilding: out.faceToBuilding };
  mesh.freezeWorldMatrix();
  return [mesh];
}
export function getPickedBuilding(mesh: Mesh, faceId: number): Building | null {
  const data = mesh.metadata as { buildings?: Building[]; faceToBuilding?: number[] } | undefined;
  const id = data?.faceToBuilding?.[faceId];
  return id === undefined ? null : data?.buildings?.[id] ?? null;
}
export function highlightBuilding(scene: Scene, b: Building): Mesh[] {
  const result: Mesh[] = [];
  for (const polygon of b.polygons) {
    const exterior = polygon[0];
    if (!exterior || exterior.length < 3) continue;
    const points = exterior.map(project).map(p => new Vector3(p.x, b.height + 0.12, p.z));
    if (Vector3.Distance(points[0], points[points.length - 1]) > 0.01) points.push(points[0].clone());
    const line = MeshBuilder.CreateLines('selection', { points }, scene);
    line.color = new Color3(1, 0.69, 0.2);
    line.isPickable = false;
    result.push(line);
  }
  return result;
}
