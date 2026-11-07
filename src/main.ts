import {
  Color3, Color4, DirectionalLight, Engine, HemisphericLight,
  Mesh, MeshBuilder, Scene, StandardMaterial, Vector3
} from '@babylonjs/core';
import { createMaterials, getPickedBuilding, highlightBuilding } from './buildings';
import { MobileCamera } from './mobileCamera';
import { loadInfrastructure } from './infrastructure';
import { TileManager } from './tileManager';
import { TreeLayer } from './trees';
import type { Building } from './types';
import './style.css';

function el<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error('Élément manquant : ' + id);
  return element as T;
}
const canvas = el<HTMLCanvasElement>('scene');
const error = el<HTMLDivElement>('error');
const state = el<HTMLElement>('state');
const counter = el<HTMLElement>('count');
const fps = el<HTMLElement>('fps');
const vegetation = el<HTMLElement>('vegetation');
const urban = el<HTMLElement>('urban');

try {
  const engine = new Engine(canvas, true, { preserveDrawingBuffer: false, stencil: false }, true);
  const scene = new Scene(engine);
  scene.clearColor = new Color4(0.74, 0.82, 0.86, 1);
  const ambient = new HemisphericLight('ciel', new Vector3(0, 1, 0), scene);
  ambient.intensity = 0.95;
  ambient.groundColor = new Color3(0.45, 0.51, 0.55);
  const sunlight = new DirectionalLight('soleil', new Vector3(-0.5, -1, -0.4), scene);
  sunlight.intensity = 0.6;

  const ground = MeshBuilder.CreateGround('sol', { width: 7000, height: 7000 }, scene);
  const groundMat = new StandardMaterial('sol', scene);
  groundMat.diffuseColor = new Color3(0.51, 0.52, 0.49);
  groundMat.specularColor = Color3.Black();
  ground.material = groundMat;
  ground.isPickable = false;

  const camera = new MobileCamera(scene, canvas);
  const material = createMaterials(scene);
  const trees = new TreeLayer(scene, message => { vegetation.textContent = message; });
  const manager = new TileManager(scene, material, (message, number) => {
    state.textContent = message;
    counter.textContent = number.toLocaleString('fr-FR') + ' bâtiments chargés';
  });
  const selection: Mesh[] = [];
  const clear = () => {
    el('selection').classList.add('hidden');
    selection.splice(0).forEach(m => m.dispose());
  };
  const select = (building: Building) => {
    clear();
    selection.push(...highlightBuilding(scene, building));
    el('selection').classList.remove('hidden');
    el('height').textContent = building.height.toLocaleString('fr-FR') + ' m' + (building.estimatedHeight ? ' (estimation)' : '');
    el('usage').textContent = building.usage || 'Non renseigné';
    el('identifier').textContent = building.id;
    el('caveat').textContent = building.estimatedHeight ?
      'Hauteur indicative : donnée IGN manquante.' : 'Emprise et hauteur issues de la BD TOPO IGN.';
  };
  camera.onTap = (x, y) => {
    const hit = scene.pick(x, y, mesh => mesh.isPickable && Boolean(mesh.metadata));
    const found = hit?.pickedMesh && hit.faceId >= 0 ?
      getPickedBuilding(hit.pickedMesh as Mesh, hit.faceId) : null;
    if (found) select(found); else clear();
  };
  el('close').addEventListener('click', clear);
  el('home').addEventListener('click', () => camera.recenter());
  el('north').addEventListener('click', () => camera.north());
  el('plus').addEventListener('click', () => camera.zoom(0.76));
  el('minus').addEventListener('click', () => camera.zoom(1.3));
  const quality = el<HTMLSelectElement>('quality');
  quality.addEventListener('change', () => {
    const level = quality.value as 'low' | 'medium' | 'high';
    manager.setQuality(level);
    trees.setQuality(level);
    engine.setHardwareScalingLevel(level === 'low' ? 1.65 : level === 'medium' ? 1.30 : 1);
  });
  quality.dispatchEvent(new Event('change'));
  window.addEventListener('resize', () => engine.resize());
  let lastFpsUpdate = 0;
  engine.runRenderLoop(() => {
    scene.render();
    manager.update(camera.camera.target.x, camera.camera.target.z);
    trees.update(camera.camera.target.x, camera.camera.target.z);
    const now = performance.now();
    if (now - lastFpsUpdate > 1000) {
      fps.textContent = Math.round(engine.getFps()) + ' FPS';
      lastFpsUpdate = now;
    }
  });
  void trees.init().catch((e: unknown) => {
    console.warn('Arbres Paris Data', e);
    vegetation.textContent = 'Arbres indisponibles';
  });
  void loadInfrastructure(scene).then((message) => {
    urban.textContent = message;
  }).catch((e: unknown) => {
    console.warn('Voirie OpenStreetMap', e);
    urban.textContent = 'Voirie indisponible';
  });
  void manager.init().catch((e: unknown) => {
    error.textContent = e instanceof Error ? e.message : 'Données cartographiques non disponibles.';
    error.classList.remove('hidden');
    state.textContent = 'Données indisponibles';
  });
  if ('serviceWorker' in navigator) {
    void import('virtual:pwa-register').then(({registerSW}) => registerSW({immediate:true})).catch(console.warn);
  }
} catch (e) {
  error.textContent = e instanceof Error ? e.message : 'WebGL non pris en charge par cet appareil.';
  error.classList.remove('hidden');
}
