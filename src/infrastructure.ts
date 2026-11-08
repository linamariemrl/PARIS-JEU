import { Color3, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3, VertexData } from '@babylonjs/core';
import earcut from 'earcut';
import { addBridges } from './bridges';

/** Réseau simplifié issu de géométries IGN ou OSM (coordonnées locales en mètres).
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
  sourceUrl?: string;
  waterApproximate: boolean;
  widthsApproximate: boolean;
  counts: { roads: number; bridges: number };
  layers: Record<string, Layer>;
}
type Kind = 'water' | 'bank' | 'sidewalk' | 'road' | 'foot' | 'square';
// Palette pierre de Paris : contrastes neutres, jamais de photographie.
export const NEUTRAL_PALETTE = {
  ground: .94, buildings: .965, roofs: .82,
  river: .74, bank: .81, road: .655, sidewalk: .91,
  foot: .85, square: .89, border: .47
} as const;
const COLORS: Record<Kind, [number, number, number]> = {
  water: [.73,.75,.76],
  bank: [.78,.76,.71],
  sidewalk: [.82,.81,.78],
  road: [.73,.73,.72],
  foot: [.78,.77,.72],
  square: [.77,.76,.72],
};
const HEIGHTS: Record<Kind, number> = {
  water: 0.05, bank: 0.085, sidewalk: 0.10, road: 0.14,
  foot: 0.16, square: 0.17,
};
const DRAW_ORDER: Kind[] = ['water', 'bank', 'sidewalk', 'road', 'foot', 'square'];

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
  // Une eau sombre ne doit pas devenir noire en lumière rasante ;
  // les tons cartographiques sont stables quel que soit le 360°.
  material.disableLighting=true;
  material.emissiveColor=new Color3(.025,.025,.025);
  material.backFaceCulling = false;
  mesh.material = material;
  mesh.isPickable = false;
  mesh.freezeWorldMatrix();
  return mesh;
}

type Coordinates=[number,number];
type MultiBoundary={type:'Polygon'|'MultiPolygon';coordinates:Coordinates[][]|Coordinates[][][]};
type BoundaryDocument={type:'Feature';geometry:MultiBoundary;properties?:Record<string,unknown>};

/** Traits fins placés sur les coordonnées officielles du 4e.
 * Aucune délimitation inventée ni frontière dessinée de mémoire.
 */
export async function addAdministrativeOutline(scene:Scene):Promise<number>{
  const result=await fetch(import.meta.env.BASE_URL+'data/4e/boundary.geojson');
  if(!result.ok)throw new Error('Limites officielles indisponibles');
  const feature=await result.json() as BoundaryDocument;
  if(feature.type!=='Feature'||!feature.geometry)throw new Error('Frontière invalide');
  const coords=feature.geometry.type==='Polygon'?
    [feature.geometry.coordinates as Coordinates[][]]:
    feature.geometry.type==='MultiPolygon'?
    feature.geometry.coordinates as Coordinates[][][]:null;
  if(!coords)throw new Error('Frontière non polygonale');
  // On ne trace que les contours extérieurs, sans confondre une île avec un trou.
  const lon0=2.3537,lat0=48.8545;
  const mx=111320*Math.cos(lat0*Math.PI/180),mz=111132;
  let total=0;
  for(const polygon of coords){
    const boundary=polygon[0];
    if(!boundary||boundary.length<4)continue;
    const points=boundary.map(([lon,lat])=>
      new Vector3((lon-lon0)*mx,.235,(lat-lat0)*mz));
    const mesh=MeshBuilder.CreateLines('limite-officielle-4e-'+total,{
      points,updatable:false
    },scene);
    mesh.color=new Color3(.42,.42,.42);
    mesh.alpha=.72;
    mesh.isPickable=false;
    total++;
  }
  return total;
}

/** Frontières IGN ADMIN EXPRESS et arrondissements Paris Data.
 * Pas de façades ni d'immeubles inventés dans les autres arrondissements.
 * Les courbes restent attachées au terrain et non à l'écran.
 */
export async function loadMetropolitanOutlines(scene:Scene):Promise<number>{
  const response=await fetch(import.meta.env.BASE_URL+'data/metropole/limits.geojson');
  if(!response.ok)throw Error('Périmètre métropolitain non encore publié');
  type Feature={properties:{kind:string;id:string};
    geometry:{type:'Polygon'|'MultiPolygon';coordinates:unknown}};
  const data=await response.json() as {type:string;features:Feature[]};
  if(data.type!=='FeatureCollection'||data.features.length<40)
    throw Error('Périmètre IGN incomplet');
  const config:{[key:string]:{color:number;alpha:number;height:number}}={
    arrondissement:{color:.55,alpha:.76,height:.24},
    paris:{color:.32,alpha:.91,height:.25},
    commune_limitrophe:{color:.66,alpha:.57,height:.23}
  };
  const group=new Map<string,Vector3[][]>();
  const LON=2.3537,LAT=48.8545;
  const mx=111320*Math.cos(LAT*Math.PI/180),mz=111132;
  let total=0;
  for(const f of data.features){
    const conf=config[f.properties.kind];if(!conf)continue;
    const raw=f.geometry.type==='Polygon'?
      [f.geometry.coordinates] : f.geometry.type==='MultiPolygon'?
      f.geometry.coordinates : null;
    if(!Array.isArray(raw))continue;
    for(const rawPolygon of raw){
      if(!Array.isArray(rawPolygon)||!Array.isArray(rawPolygon[0]))continue;
      const ring=rawPolygon[0] as number[][];
      if(ring.length<4)continue;
      const points=ring.filter(x=>x.length>=2).map(([lon,lat])=>
        new Vector3((lon-LON)*mx,conf.height,(lat-LAT)*mz));
      if(points.length<4)continue;
      const collection=group.get(f.properties.kind)??[];
      collection.push(points);
      group.set(f.properties.kind,collection);
      total++;
    }
  }
  if(!group.has('paris')||!group.has('arrondissement'))
    throw Error('Contours officiels mal formés');
  for(const [kind,lines] of group){
    const mesh=MeshBuilder.CreateLineSystem('limites-'+kind,{lines},scene);
    const conf=config[kind];
    mesh.color=new Color3(conf.color,conf.color,conf.color);
    mesh.alpha=conf.alpha;
    mesh.isPickable=false;
  }
  return total;
}

/** Filet de berge en géométrie réelle selon l'emprise hydraulique disponible.
 * Largeur des rives / eau : attribuée à la source data/4e/infrastructure.json.
 */
function shoreline(scene:Scene,water:Layer):void{
  const positions:number[]=[];
  for(const poly of water){
    if(!poly?.length)continue;
    for(const ring of poly){
      if(ring.length<4)continue;
      // Le tracé est continu en monde réel, pas une étiquette d'écran.
      for(const [x,z] of ring){
        positions.push(x,.078,z);
      }
      positions.push(NaN,NaN,NaN);
    }
  }
  let n=0;
  let current:number[]=[];
  function flush(){
    if(current.length>=6){
      const pts:Vector3[]=[];
      for(let j=0;j<current.length;j+=3)
        pts.push(new Vector3(current[j],current[j+1],current[j+2]));
      const line=MeshBuilder.CreateLines('berge-'+n++,{points:pts},scene);
      line.color=new Color3(.53,.53,.53);
      line.alpha=.62;line.isPickable=false;
    }
    current=[];
  }
  for(let i=0;i<positions.length;i+=3){
    if(!Number.isFinite(positions[i]))flush();
    else current.push(positions[i],positions[i+1],positions[i+2]);
  }
}

export async function loadInfrastructure(scene: Scene): Promise<string> {
  const response = await fetch(import.meta.env.BASE_URL + 'data/4e/infrastructure.json');
  if (!response.ok) throw new Error('Données des rues non encore préparées.');
  const data = await response.json() as InfrastructureData;
  if (data.schema !== 1 || !data.layers || !data.layers.road?.length || !data.layers.water?.length) {
    throw new Error('Données de voirie incomplètes.');
  }
  const credit = document.getElementById('map-credits') as HTMLAnchorElement | null;
  if (credit) {
    const isIgn = data.source.startsWith('IGN');
    credit.textContent = isIgn ? '© IGN' : '© OpenStreetMap';
    credit.href = data.sourceUrl || (isIgn ? 'https://geoservices.ign.fr/bdtopo' : 'https://www.openstreetmap.org/copyright');
  }
  for (const kind of DRAW_ORDER) layerMesh(scene, kind, data.layers[kind] || []);
  addBridges(scene, data.layers.bridge || []);
  shoreline(scene,data.layers.water||[]);
  const n = data.counts.roads.toLocaleString('fr-FR');
  const p = data.counts.bridges.toLocaleString('fr-FR');
  return `${n} tronçons de voirie · ${p} passages surélevés` +
    (data.waterApproximate ? ' · largeur de Seine schématique' : '');
}
