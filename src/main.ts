import {
  Color3, Color4, DirectionalLight, Engine, HemisphericLight,
  Mesh, MeshBuilder, Scene, StandardMaterial, Vector3
} from '@babylonjs/core';
import { createMaterials, getPickedBuilding, highlightBuilding } from './buildings';
import { MobileCamera } from './mobileCamera';
import { loadInfrastructure, addAdministrativeOutline, loadMetropolitanOutlines } from './infrastructure';
import { TileManager } from './tileManager';
import { MetroTileManager } from './metroTiles';
import { MetroOverview } from './metroOverview';
import { installTerritoryNavigation } from './territoryNavigation';
import { GameClock, type TimeSpeed } from './gameClock';
import { TreeLayer } from './trees';
import { MetroTreeLayer } from './metroTrees';
import { installSurfaceLayer } from './surfaceLayer';
import { GameManagement } from './simulation/ui';
import { describeMaterial } from './materialCatalog';
import { roofProfile, roofShapeDescription } from './roofGeometry';
import { project } from './geo';
import type { Building } from './types';
import './style.css';

function el<T extends HTMLElement>(id:string):T{
  const e=document.getElementById(id);
  if(!e)throw new Error('Élément manquant : '+id);
  return e as T;
}
const canvas=el<HTMLCanvasElement>('scene');
const error=el<HTMLDivElement>('error');
const state=el<HTMLElement>('state');
const counter=el<HTMLElement>('count');
const fps=el<HTMLElement>('fps');
const urban=el<HTMLElement>('urban');

try{
  const engine=new Engine(canvas,true,{
    preserveDrawingBuffer:false,stencil:false,antialias:true
  },true);
  const scene=new Scene(engine);
  scene.fogMode=Scene.FOGMODE_NONE;
  scene.clearColor=new Color4(.88,.875,.855,1);
  const ambient=new HemisphericLight('éclairage-fixe',new Vector3(0,1,0),scene);
  ambient.intensity=.69;
  ambient.groundColor=new Color3(.62,.62,.62);
  const directional=new DirectionalLight('lumière-fixe',
    new Vector3(-.45,-1,-.28),scene);
  directional.intensity=.42;
  const clock=new GameClock();
  const trees=new TreeLayer(scene,message=>{
    el('trees-status').textContent=message;
  });
  const metroTrees=new MetroTreeLayer(scene,message=>{
    el('metro-trees-status').textContent=message;
  });

  const ground=MeshBuilder.CreateGround('sol-neutre',
    {width:40000,height:40000},scene);
  const mat=new StandardMaterial('sol-gris-clair',scene);
  mat.diffuseColor=new Color3(.89,.88,.86);
  mat.specularColor=Color3.Black();
  mat.freeze();
  ground.material=mat;ground.isPickable=false;

  const camera=new MobileCamera(scene,canvas);
  const materials=createMaterials(scene);
  let metroCount=0;
  let overviewCount=0;
  let fourthCount=0;
  const showCounts=()=>{
    counter.textContent=(fourthCount+metroCount+overviewCount)
      .toLocaleString('fr-FR')+' bâtiments représentés';
  };
  const manager=new TileManager(scene,materials,(message,count)=>{
    state.textContent=message;
    fourthCount=count;showCounts();
  });
  const overview=new MetroOverview(scene,(message,count)=>{
    overviewCount=count;showCounts();
    el('overview-status').textContent=message;
  });
  const metro=new MetroTileManager(scene,materials,(message,count)=>{
    metroCount=count;showCounts();
    el('metropole-status').textContent=message;
  },overview);
  const selection:Mesh[]=[];
  const clear=()=>{
    el('selection').classList.add('hidden');
    selection.splice(0).forEach(m=>m.dispose());
  };
  const select=(b:Building)=>{
    clear();
    selection.push(...highlightBuilding(scene,b));
    el('selection').classList.remove('hidden');
    el('height').textContent=b.height.toLocaleString('fr-FR')+' m'+
      (b.estimatedHeight?' (estimée)':' (IGN)');
    el('usage').textContent=b.usage||'Non renseigné';
    el('skin').textContent='Pierre claire stylisée, sans texture photographique';
    el('wall-real').textContent=describeMaterial(b.wallCode,false);
    el('roof-real').textContent=describeMaterial(b.roofCode,true);
    el('floors-real').textContent=b.floors?
      b.floors.toLocaleString('fr-FR')+' niveau(x) déclarés':'non renseigné';
    const roof=b.roofInfo;
    const exterior=b.polygons[0]?.[0]?.map(project)??[];
    const profile=roofProfile(roof,b.height,exterior);
    el('roof-form').textContent=b.lidarRoof?
      'Relief de toiture MNH LiDAR HD IGN mesuré (maillage simplifié)' :roof?
      roofShapeDescription(roof.shape)+
      (profile?.estimated?' (pente estimée)':' (pente documentée si disponible)'):
      'forme non documentée : toit de secours plat';
    el('volume-information').textContent=b.lidarRoof?
      'Relief LiDAR prioritaire'+(b.volumes?' ; subdivisions municipales conservées en référence':''):
      b.volumes?b.volumes.parts.length.toLocaleString('fr-FR')+
      ' subdivisions municipales (hauteurs internes estimées)':
      'emprise IGN (sans subdivision validée)';
    el('identifier').textContent=b.id;
    el('caveat').textContent=
      'Les contours et hauteurs proviennent des sources indiquées dans Détails. '+
      'Les matériaux fiscaux ne sont pas représentés. '+
      (b.volumes?(b.lidarRoof?'Subdivisions municipale disponibles mais non affichées sous le LiDAR. ':
 'Subdivisions géométriques Ville de Paris, altitudes internes estimées. '):'')+
      (roof?'Type de toiture OSM, pente non toujours mesurée. ':
        'Forme de toiture inconnue. ')+
      (b.lidarRoof?
        'Relief de couverture MNH LiDAR HD, IGN 50 cm, prioritaire lorsqu’il est valide. ':
        'Toit LiDAR non disponible ; forme OSM ou toit de secours. ');
  };
  camera.onTap=(x,y)=>{
    const hit=scene.pick(x,y,mesh=>mesh.isPickable&&Boolean(mesh.metadata));
    const selected=hit?.pickedMesh&&hit.faceId>=0?
      getPickedBuilding(hit.pickedMesh as Mesh,hit.faceId):null;
    if(selected)select(selected);else clear();
  };
  el('close').addEventListener('click',clear);
  el('north').addEventListener('click',()=>camera.north());
  el('plus').addEventListener('click',()=>camera.zoom(.78));
  el('minus').addEventListener('click',()=>camera.zoom(1.28));
  const precision=el<HTMLInputElement>('precision-mode');
  precision.addEventListener('change',()=>camera.setPrecisionMode(precision.checked));
  camera.setPrecisionMode(precision.checked);
  const orbit=el<HTMLButtonElement>('orbit-view');
  const street=el<HTMLButtonElement>('street-view');
  const pad=el<HTMLElement>('movement-pad');
  function updateCameraButtons(){
    orbit.setAttribute('aria-pressed',String(camera.isOrbitMode));
    orbit.textContent=camera.isOrbitMode?'Pan':'360°';
    orbit.disabled=camera.isStreetMode;
    street.setAttribute('aria-pressed',String(camera.isStreetMode));
    street.textContent=camera.isStreetMode?'Carte':'Rue';
    pad.classList.toggle('hidden',!camera.isStreetMode);
  }
  orbit.addEventListener('click',()=>{
    camera.setOrbitMode(!camera.isOrbitMode);
    updateCameraButtons();
  });
  street.addEventListener('click',()=>{
    camera.setStreetMode(!camera.isStreetMode);
    updateCameraButtons();
  });
  el('home').addEventListener('click',()=>{
    camera.recenter();
    updateCameraButtons();
  });
  updateCameraButtons();
  void installTerritoryNavigation(camera,updateCameraButtons).catch(console.warn);
  const held=new Set<string>();
  for(const button of Array.from(pad.querySelectorAll<HTMLButtonElement>('[data-move]'))){
    const command=button.dataset.move;
    if(!command)continue;
    button.addEventListener('pointerdown',(event:PointerEvent)=>{
      event.preventDefault();
      held.add(command);
      button.setPointerCapture(event.pointerId);
    });
    for(const event of ['pointerup','pointercancel','lostpointercapture']){
      button.addEventListener(event,()=>held.delete(command));
    }
  }
  const quality=el<HTMLSelectElement>('quality');
  quality.addEventListener('change',()=>{
    const level=quality.value as 'low'|'medium'|'high';
    manager.setQuality(level);
    metro.setQuality(level);
    trees.setQuality(level);
    metroTrees.setQuality(level);
    engine.setHardwareScalingLevel(level==='low'?1.7:level==='medium'?1.3:1);
    engine.resize();
  });
  quality.dispatchEvent(new Event('change'));

  const speedButtons:ReadonlyArray<{id:string;rate:TimeSpeed}>=[
    {id:'time-pause',rate:0},{id:'time-normal',rate:1},
    {id:'time-ten',rate:10},{id:'time-sixty',rate:60}
  ];
  const selectRate=(rate:TimeSpeed)=>{
    clock.setRate(rate);
    for(const item of speedButtons)
      el<HTMLButtonElement>(item.id).setAttribute('aria-pressed',
        String(item.rate===rate));
  };
  for(const item of speedButtons)
    el<HTMLButtonElement>(item.id).addEventListener('click',()=>selectRate(item.rate));
  selectRate(1);
  const management=new GameManagement(clock,selectRate);
  void management;
  window.addEventListener('resize',()=>engine.resize());
  let lastFps=0,lastClock=0,previous=performance.now();
  engine.runRenderLoop(()=>{
    const now=performance.now();
    const dt=Math.min(.05,Math.max(0,(now-previous)/1000));
    previous=now;
    camera.step(dt);
    if(camera.isStreetMode&&held.size){
      const forward=(held.has('forward')?1:0)-(held.has('back')?1:0);
      const side=(held.has('right')?1:0)-(held.has('left')?1:0);
      const length=Math.max(1,Math.hypot(forward,side));
      const speed=camera.isPrecisionMode?4:12;
      camera.moveStreet(forward/length*speed*dt,side/length*speed*dt);
    }
    clock.tick(now);
    if(now-lastClock>=350){
      el('game-clock').textContent=clock.label();
      lastClock=now;
    }
    manager.update(camera.camera.target.x,camera.camera.target.z);
    overview.update(camera.camera.target.x,camera.camera.target.z,camera.camera.radius);
    metro.update(camera.camera.target.x,camera.camera.target.z,camera.camera.radius);
    metroTrees.update(camera.camera.target.x,camera.camera.target.z,camera.camera.radius);
    scene.render();
    if(now-lastFps>=1000){
      fps.textContent=Math.round(engine.getFps())+' FPS';
      lastFps=now;
    }
  });

  // Données géographiques réelles : arbres municipaux, sans arbres
  // inventés ni textures photographiques, sans cycle visuel jour/nuit.
  // Ordre de chargement : espaces verts, eau, chaussées. Chaque couche
  // est vectorielle, stable dans le monde et indépendante des gestes.
  void (async()=>{
    await installSurfaceLayer(scene,'data/metropole/surfaces/green.json',
      message=>el('surface-status').textContent=message);
    await installSurfaceLayer(scene,'data/metropole/surfaces/water.json',
      message=>el('water-status').textContent=message);
    await installSurfaceLayer(scene,'data/metropole/surfaces/roads.json',
      message=>el('roads-status').textContent=message);
  })().catch(console.warn);
  void metroTrees.init().catch(e=>{
    console.warn('Arbres des arrondissements non disponibles',e);
    el('metro-trees-status').textContent='Arbres des arrondissements : source absente';
  });
  void trees.init().catch(e=>{
    console.warn('Arbres municipaux non disponibles',e);
    el('trees-status').textContent='Arbres : données momentanément indisponibles';
  });
  void loadMetropolitanOutlines(scene).catch(()=>{
    void addAdministrativeOutline(scene).catch(console.warn);
  });
  void loadInfrastructure(scene).then(message=>{
    urban.textContent=message+' (couleurs et matériaux schématiques)';
  }).catch(e=>{
    console.warn('Réseau des rues non disponible',e);
    urban.textContent='Voirie non disponible';
  });
  void overview.init().catch(console.warn);
  void metro.init().catch(console.warn);
  void manager.init().catch((e:unknown)=>{
    error.textContent=e instanceof Error?e.message:'Données IGN non disponibles';
    error.classList.remove('hidden');
    state.textContent='Données indisponibles';
  });
  if('caches' in window)
    void window.caches.delete('ortho-4e-images').catch(console.warn);
  if('serviceWorker' in navigator)
    void import('virtual:pwa-register').then(({registerSW})=>
      registerSW({immediate:true})).catch(console.warn);
}catch(e){
  error.textContent=e instanceof Error?e.message:'WebGL non disponible';
  error.classList.remove('hidden');
}
