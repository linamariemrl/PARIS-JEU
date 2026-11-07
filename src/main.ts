import {
  Color3, Engine, Mesh, MeshBuilder, Scene, StandardMaterial
} from '@babylonjs/core';
import { createMaterials, facadeCategory, getPickedBuilding, highlightBuilding } from './buildings';
import { MobileCamera } from './mobileCamera';
import { loadInfrastructure } from './infrastructure';
import { TileManager } from './tileManager';
import { TreeLayer } from './trees';
import { StreetLabels } from './streetLabels';
import { GameClock, type TimeSpeed } from './gameClock';
import { SkyAndSun } from './sky';
import { installNightWindows } from './nightWindows';
import { StreetLighting } from './streetLighting';
import type { Building } from './types';
import { describeMaterial } from './materialCatalog';
import { roofProfile, roofShapeDescription } from './roofGeometry';
import { project } from './geo';
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
  scene.fogMode = Scene.FOGMODE_EXP2;
  const sky = new SkyAndSun(scene);
  const clock = new GameClock();

  const ground = MeshBuilder.CreateGround('sol', { width: 7000, height: 7000 }, scene);
  const groundMat = new StandardMaterial('sol', scene);
  groundMat.diffuseColor = new Color3(0.51, 0.52, 0.49);
  groundMat.specularColor = Color3.Black();
  ground.material = groundMat;
  ground.isPickable = false;

  const camera = new MobileCamera(scene, canvas);
  const material = createMaterials(scene);
  const updateNightWindows = installNightWindows(scene, material);
  const streetLighting = new StreetLighting(scene);
  const trees = new TreeLayer(scene, message => { vegetation.textContent = message; });
  const streetLabels = new StreetLabels(scene, engine);
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
    const styles = { residential: 'habillage résidentiel stylisé', commercial: 'habillage commercial stylisé', religious: 'habillage religieux stylisé', neutral: 'habillage neutre stylisé' };
    el('skin').textContent = building.wallCode ?
      'habillage correspondant au matériau cadastral, détails illustratifs' :
      styles[facadeCategory(building)];
    el('wall-real').textContent = describeMaterial(building.wallCode,false);
    el('roof-real').textContent = describeMaterial(building.roofCode,true);
    el('floors-real').textContent = building.floors ?
      building.floors.toLocaleString('fr-FR') + ' niveau(x) déclarés' :
      'non renseigné';
    const roofData=building.roofInfo;
    const outer=building.polygons[0]?.[0]?.map(project)??[];
    const profile=roofProfile(roofData,building.height,outer);
    el('roof-form').textContent=roofData ?
      roofShapeDescription(roofData.shape)+
      (profile?.estimated ? ' (pente estimée)' : ' (pente documentée si disponible)') :
      'forme non documentée';
    el('identifier').textContent = building.id;
    el('caveat').textContent =
      (building.estimatedHeight ? 'Hauteur indicative. ' : 'Emprise et hauteur IGN. ') +
      'Matériaux de gros murs et de couverture issus des données fiscales lorsqu’ils sont connus ; ' +
      'les fenêtres restent illustratives. ' +
      (roofData ? 'Forme du toit OSM (© contributeurs OSM). ' :
        'Forme du toit non renseignée. ') +
      'Les dimensions non mesurées restent des approximations.';
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
    streetLighting.setQuality(level);
    engine.setHardwareScalingLevel(level === 'low' ? 1.65 : level === 'medium' ? 1.30 : 1);
  });
  quality.dispatchEvent(new Event('change'));
  const speedButtons: ReadonlyArray<{id:string;rate:TimeSpeed}> = [
    {id:'time-pause',rate:0}, {id:'time-normal',rate:1},
    {id:'time-ten',rate:10}, {id:'time-sixty',rate:60}
  ];
  const selectRate = (rate:TimeSpeed) => {
    clock.setRate(rate);
    for(const item of speedButtons) {
      const button = el<HTMLButtonElement>(item.id);
      button.setAttribute('aria-pressed',String(item.rate===rate));
    }
  };
  for(const item of speedButtons) {
    el<HTMLButtonElement>(item.id).addEventListener('click',()=>selectRate(item.rate));
  }
  selectRate(1);
  window.addEventListener('resize', () => engine.resize());
  let lastFpsUpdate = 0;
  let lastEnvironmentUpdate = -1000;
  engine.runRenderLoop(() => {
    const now = performance.now();
    clock.tick(now);
    if (now - lastEnvironmentUpdate >= 450) {
      const light = sky.update(clock.current);
      streetLighting.updateBrightness(light.nightFactor);
      updateNightWindows(light.nightFactor,clock.localHour());
      el('game-clock').textContent = clock.label();
      el('moon-phase').textContent = 'Lune ' + Math.round(light.moonFraction*100) + ' %';
      lastEnvironmentUpdate = now;
    }
    sky.followCamera();
    scene.render();
    manager.update(camera.camera.target.x, camera.camera.target.z);
    trees.update(camera.camera.target.x, camera.camera.target.z);
    streetLighting.updatePosition(camera.camera.target.x, camera.camera.target.z);
    streetLabels.update(camera.camera.radius, camera.camera.target.x, camera.camera.target.z);
    if (now - lastFpsUpdate > 1000) {
      fps.textContent = Math.round(engine.getFps()) + ' FPS';
      lastFpsUpdate = now;
    }
  });
  void streetLighting.init().catch((e: unknown) => {
    console.warn('Mobilier lumineux simulé',e);
  });
  void streetLabels.init().catch((e: unknown) => {
    console.warn('Noms officiels des voies', e);
    el('streets').textContent = 'Noms de rues indisponibles';
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
