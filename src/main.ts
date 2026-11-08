import {
  Color3, Color4, DirectionalLight, Engine, HemisphericLight,
  Matrix, Mesh, MeshBuilder, Scene, StandardMaterial, Vector3
} from '@babylonjs/core';
import { createMaterials, getPickedBuilding, highlightBuilding } from './buildings';
import { MobileCamera } from './mobileCamera';
import { loadInfrastructure } from './infrastructure';
import { TileManager } from './tileManager';
import { MetroTileManager } from './metroTiles';
import { MetroOverview } from './metroOverview';
import { installTerritoryNavigation } from './territoryNavigation';
import { GameClock, type TimeSpeed } from './gameClock';
import { TreeLayer } from './trees';
import { MetroTreeLayer } from './metroTrees';
import { SurfaceTileManager } from './surfaceTiles';
import { AdaptiveResolution } from './adaptiveResolution';
import { TerrainModule } from './terrain';
import { StableWaterLayer } from './stableWater';
import { PlaceInspector,centerOfBuilding } from './placeInspector';
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
/** Mode de récupération 0.20 : moteur éprouvé 0.17.
 * Les extensions SIG/LiDAR colorées restent dans le dépôt mais ne
 * dessinent plus de doubles surfaces/arbres/relief pendant le jeu.
 */
const STABLE_RENDER=true;

try{
  const engine=new Engine(canvas,true,{
    preserveDrawingBuffer:false,stencil:false,antialias:true
  },true);
  const scene=new Scene(engine);
  scene.fogMode=Scene.FOGMODE_NONE;
  scene.clearColor=new Color4(.89,.89,.88,1);
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
    {width:80000,height:80000,sideOrientation:Mesh.DOUBLESIDE},scene);
  ground.position.y=-.5;
  const mat=new StandardMaterial('sol-gris-clair',scene);
  // Fond minéral mat, pour séparer les espaces ouverts des façades.
  // Aucun éclairage temporel ni texture ajoutée.
  mat.diffuseColor=new Color3(.86,.86,.85);
  mat.emissiveColor=new Color3(.06,.06,.06);
  mat.disableLighting=true;
  mat.specularColor=Color3.Black();
  mat.freeze();
  ground.material=mat;ground.isPickable=true;
  const terrain=new TerrainModule(scene,status=>{
    el('terrain-status').textContent=status;
  });

  const camera=new MobileCamera(scene,canvas);
  const resolution=new AdaptiveResolution(engine);
  const materials=createMaterials(scene);
  const surfaces=new SurfaceTileManager(scene,message=>{
    el('surface-status').textContent=message;
  });
  const water=new StableWaterLayer(scene,message=>{
    el('water-status').textContent=message;
  });
  let metroCount=0;
  let overviewCount=0;
  let fourthCount=0;
  const showCounts=()=>{
    counter.textContent=(fourthCount+metroCount+overviewCount)
      .toLocaleString('fr-FR')+' bâtiments chargés dans la vue';
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
  // Les nouvelles couches peuvent être désactivées indépendamment
  // sans modifier les données officielles ni les sauvegardes du jeu.
  const waterToggle=el<HTMLInputElement>('water-layer-toggle');
  const lodToggle=el<HTMLInputElement>('roof-lod-toggle');
  waterToggle.addEventListener('change',()=>water.setVisible(waterToggle.checked));
  lodToggle.addEventListener('change',()=>
    overview.setRoofLodEnabled(lodToggle.checked));
  water.setVisible(waterToggle.checked);
  overview.setRoofLodEnabled(lodToggle.checked);
  const selection:Mesh[]=[];
  const inspector=new PlaceInspector(el('place-extra'));
  let tapSequence=0;
  const clear=()=>{
    inspector.begin();
    el('selection').classList.add('hidden');
    selection.splice(0).forEach(m=>m.dispose());
  };
  const select=(b:Building)=>{
    clear();
    const coords=centerOfBuilding(b)??{
      x:camera.camera.target.x,z:camera.camera.target.z
    };
    const token=inspector.begin();
    el('selection-title').textContent='Bâtiment identifié · données IGN';
    el('building-fields').classList.remove('hidden');
    selection.push(...highlightBuilding(scene,b));
    el('selection').classList.remove('hidden');
    el('height').textContent=b.height.toLocaleString('fr-FR')+' m'+
      (b.estimatedHeight?' (estimée)':' (IGN)');
    el('usage').textContent=b.usage||'Non renseigné';
    el('skin').textContent='Maquette neutre restaurée, parements non documentés';
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
    inspector.fill(coords.x,coords.z,
      surfaces.identify(coords.x,coords.z)??water.identify(coords.x,coords.z),b,token);
  };
  const showLocation=(x:number,z:number)=>{
    clear();
    const token=inspector.begin();
    el('selection-title').textContent='Fiche du lieu sélectionné';
    el('building-fields').classList.add('hidden');
    el('selection').classList.remove('hidden');
    inspector.fill(x,z,surfaces.identify(x,z)??water.identify(x,z),null,token);
  };
  camera.onTap=(x,y)=>{
    const requestId=++tapSequence;
    const hit=scene.pick(x,y,mesh=>mesh.isPickable&&Boolean(mesh.metadata));
    const selected=hit?.pickedMesh&&hit.faceId>=0?
      getPickedBuilding(hit.pickedMesh as Mesh,hit.faceId):null;
    if(selected){select(selected);return;}
    const groundHit=scene.pick(x,y,m=>m===ground||
      m.name==='terrain-RGE-ALTI-IGN');
    const point=groundHit?.pickedPoint;
    let px=point?.x,pz=point?.z;
    if(px===undefined||pz===undefined){
      const ray=scene.createPickingRay(x,y,Matrix.Identity(),camera.camera);
      const scale=Math.abs(ray.direction.y)>1e-6?
        -ray.origin.y/ray.direction.y:NaN;
      px=Number.isFinite(scale)&&scale>0?
        ray.origin.x+scale*ray.direction.x:camera.camera.target.x;
      pz=Number.isFinite(scale)&&scale>0?
        ray.origin.z+scale*ray.direction.z:camera.camera.target.z;
    }
    showLocation(px,pz);
    // Même en vue générale, une emprise IGN dans les tuiles légères
    // peut être retrouvée sur demande sans lancer un chargement 3D.
    void metro.buildingAt(px,pz).then(building=>{
      if(requestId===tapSequence&&building)select(building);
    }).catch(console.warn);
  };
  el('close').addEventListener('click',()=>{
    tapSequence++;clear();
  });
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
    if(STABLE_RENDER){
      // Échelle GPU constante au cours des mouvements : comportement 0.17.
      engine.setHardwareScalingLevel(
        level==='low'?1.7:level==='medium'?1.3:1
      );
      engine.resize();
    }else{
      trees.setQuality(level);
      metroTrees.setQuality(level);
      surfaces.setQuality(level);
      resolution.configure(level);
    }
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
    overview.update(camera.camera.target.x,camera.camera.target.z,
      camera.camera.radius,camera.isMoving);
    metro.update(camera.camera.target.x,camera.camera.target.z,camera.camera.radius);
    if(!STABLE_RENDER){
      metroTrees.update(camera.camera.target.x,camera.camera.target.z,camera.camera.radius);
      trees.update(camera.camera.radius);
      surfaces.update(camera.camera.target.x,camera.camera.target.z,camera.camera.radius,camera.isMoving);
    }
    scene.render();
    if(!STABLE_RENDER)
      resolution.update(now,engine.getFps(),camera.isMoving);
    if(now-lastFps>=1000){
      fps.textContent=Math.round(engine.getFps())+' FPS';
      lastFps=now;
    }
  });

  // Restauration des seules couches éprouvées. Relief, arbres et
  // surfaces du prototype 0.19 restent disponibles comme modules
  // expérimentaux, mais ne sont pas rendus en mode récupération.
  void (async()=>{
    if(!STABLE_RENDER)await terrain.init(ground);
    await Promise.allSettled([
      inspector.init(),
      ...(STABLE_RENDER?[water.init()]:
        [surfaces.init(),metroTrees.init(),trees.init()]),
      overview.init(),metro.init(),manager.init().catch((err:unknown)=>{
        console.warn('Bâtiments du 4e indisponibles',err);
        state.textContent='Bâtiments du 4e : source indisponible';
        error.textContent=err instanceof Error?err.message:'Source IGN indisponible';
        error.classList.remove('hidden');
      }),
      loadInfrastructure(scene).then(message=>{
        // Si la géométrie du 4e arrive après l'eau IGN, on neutralise
        // son ancien polygone : jamais de double rendu au même endroit.
        water.setVisible(waterToggle.checked);
        urban.textContent=message+
          (STABLE_RENDER?' (moteur géométrique stable 0.17)':
            ' (surfaces réelles, teintes schématiques)');
      })
    ]);
    if(STABLE_RENDER){
      el('terrain-status').textContent='Relief IGN archivé · rendu expérimental désactivé';
      el('surface-status').textContent='Parcs : données conservées · rendu expérimental désactivé';
      // L'état est rempli par StableWaterLayer selon la source IGN.
      el('roads-status').textContent='Chaussées : retour à la géométrie stable du 4e';
      el('trees-status').textContent='Arbres 3D en pause pour stabilité graphique';
      el('metro-trees-status').textContent='Inventaire arboré conservé hors rendu';
    }else{
      el('water-status').textContent='Surfaces d’eau IGN : emprises sectorisées';
      el('roads-status').textContent='Chaussées PVP : emprises sectorisées';
    }
    el('places-status').textContent=inspector.monumentCount?
      inspector.monumentCount.toLocaleString('fr-FR')+
      ' notices Mérimée géolocalisées + adresses et POI IGN disponibles au clic':
      'Adresses et POI IGN consultables au clic ; notices Mérimée en préparation';
  })().catch((e:unknown)=>{
    console.warn('Initialisation géographique',e);
    error.textContent=e instanceof Error?e.message:'Initialisation géographique indisponible';
    error.classList.remove('hidden');
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
