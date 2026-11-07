import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3, VertexData } from '@babylonjs/core';
import earcut from 'earcut';

/** Réseau simplifié issu de vraies géométries OSM (coordonnées locales en mètres).
 * Un seul maillage par couche, pour ne pas multiplier les draw calls sur Android.
 * Les tabliers de pont et les largeurs par défaut sont des conventions graphiques.
 */
type XY = [number, number];
type Ring = XY[];
type Polygon = Ring[];
type Layer = Polygon[];

interface InfrastructureData {
  schema: number;
  source: string;
  waterApproximate: boolean;
  widthsApproximate: boolean;
  counts: { roads: number; bridges: number };
  layers: Record<string, Layer>;
}
type Kind = 'water' | 'bank' | 'sidewalk' | 'road' | 'foot' | 'square' | 'bridge';
const COLORS: Record<Kind, [number, number, number]> = {
  water: [0.18, 0.42, 0.51],
  bank: [0.68, 0.65, 0.59],
  sidewalk: [0.67, 0.63, 0.56],
  road: [0.29, 0.33, 0.37],
  foot: [0.79, 0.74, 0.63],
  square: [0.76, 0.70, 0.59],
  bridge: [0.42, 0.44, 0.45],
};
const HEIGHTS: Record<Kind, number> = {
  water: 0.05, bank: 0.085, sidewalk: 0.10, road: 0.14,
  foot: 0.16, square: 0.17, bridge: 0.82,
};
const DRAW_ORDER: Kind[] = ['water', 'bank', 'sidewalk', 'road', 'foot', 'square', 'bridge'];

function layerMesh(scene: Scene, kind: Kind, polygons: Layer): Mesh | null {
  const positions: number[] = [];
  const indices: number[] = [];
  const normals: number[] = [];
  const h = HEIGHTS[kind];
  for (const polygon of polygons) {
    if (!Array.isArray(polygon)) continue;
    const flat: number[] = [];
    const holes: number[] = [];
    let numberOfPoints = 0;
    for (const ring of polygon) {
      if (!Array.isArray(ring) || ring.length < 4) continue;
      const pts = ring.slice(0, -1);
      if (pts.length < 3) continue;
      if (numberOfPoints > 0) holes.push(numberOfPoints);
      for (const [x, z] of pts) {
        flat.push(x, z);
        numberOfPoints++;
      }
    }
    if (numberOfPoints < 3) continue;
    const triangles = earcut(flat, holes, 2);
    if (!triangles.length) continue;
    const offset = positions.length / 3;
    for (let i = 0; i < flat.length; i += 2) {
      positions.push(flat[i], h, flat[i + 1]);
      normals.push(0, 1, 0);
    }
    for (const index of triangles) indices.push(offset + index);
  }
  if (!indices.length) return null;
  const mesh = new Mesh('infrastructure-' + kind, scene);
  const vertexData = new VertexData();
  vertexData.positions = positions;
  vertexData.indices = indices;
  vertexData.normals = normals;
  vertexData.applyToMesh(mesh);
  const material = new StandardMaterial('materiau-' + kind, scene);
  const [r, g, b] = COLORS[kind];
  material.diffuseColor = new Color3(r, g, b);
  material.specularColor = Color3.Black();
  material.backFaceCulling = false;
  mesh.material = material;
  mesh.isPickable = false;
  mesh.freezeWorldMatrix();
  return mesh;
}

function rails(scene: Scene, polygons: Layer): Mesh | null {
  // Le garde-corps souligne les ponts visibles. Il ne représente ni les
  // matériaux ni les cotes exactes des ponts historiques.
  const lines: Vector3[][] = [];
  for (const polygon of polygons) {
    const exterior = polygon[0];
    if (!exterior || exterior.length < 4) continue;
    // Limiter la longueur des segments, sans créer un maillage par pont.
    lines.push(exterior.map(([x, z]) => new Vector3(x, HEIGHTS.bridge + 0.7, z)));
  }
  if (!lines.length) return null;
  const mesh = MeshBuilder.CreateLineSystem('garde-corps-schematiques', { lines }, scene);
  mesh.color = new Color3(0.78, 0.76, 0.68);
  mesh.isPickable = false;
  return mesh;
}

export async function loadInfrastructure(scene: Scene): Promise<string> {
  const response = await fetch(import.meta.env.BASE_URL + 'data/4e/infrastructure.json');
  if (!response.ok) throw new Error('Données des rues non encore préparées.');
  const data = await response.json() as InfrastructureData;
  if (data.schema !== 1 || !data.layers || !data.layers.road?.length || !data.layers.water?.length) {
    throw new Error('Données de voirie incomplètes.');
  }
  for (const kind of DRAW_ORDER) layerMesh(scene, kind, data.layers[kind] || []);
  rails(scene, data.layers.bridge || []);
  const n = data.counts.roads.toLocaleString('fr-FR');
  const p = data.counts.bridges.toLocaleString('fr-FR');
  return `${n} tronçons de voirie · ${p} ponts` +
    (data.waterApproximate ? ' · largeur de Seine schématique' : '');
}
