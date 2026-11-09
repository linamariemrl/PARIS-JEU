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
import { CityCoverage } from './cityCoverage';
import { installTerritoryNavigation } from './territoryNavigation';
import { GameClock, type TimeSpeed } from './gameClock';
import { TreeLayer } from './trees';
import { MetroTreeLayer } from './metroTrees';
import { SurfaceTileManager } from './surfaceTiles';
import {installSurfaceLayer} from './surfaceLayer';
import {terrainHeight} from './terrain';
import { MetroRoads } from './metroRoads';
import { AdaptiveResolution } from './adaptiveResolution';
import { TerrainModule } from './terrain';
import { StableWaterLayer } from './stableWater';
import { PlaceInspector,centerOfBuilding } from './placeInspector';
import {HeritageAtlas} from './heritageAtlas';
import {LandmarkBrowser} from './landmarkBrowser';
import {UrbanAtlas,type QuarterRecord} from './urbanAtlas';
import {QuarterOverlay,quarterAreaKm2} from './quarterSelection';
import {neighborhoodHistory,administrativeParis} from './neighborhoodHistory';
import {PlaceCards} from './placeCards';
import {HeritageGardenLayer} from './heritageGardens';
import { StreetDirectory } from './streetDirectory';
import { GameManagement } from './simulation/ui';
import {prepareAppInstallation,isNativeApp} from './appInstall';
import {REVISION,RELEASE_PHASE} from './release';
import type {GameView} from './gameView';
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
    {width:80000,height:80000},scene);
  ground.position.y=-.5;
  const mat=new StandardMaterial('sol-gris-clair',scene);
  // Fond minéral mat, pour séparer les espaces ouverts des façades.
  // Aucun éclairage temporel ni texture ajoutée.
  mat.diffuseColor=new Color3(.81,.81,.80);
  // Babylon StandardMaterial déséclairé: seule l'émission garantit
  // une couleur visible. Une émission de .06 rendait le sol presque noir.
  mat.emissiveColor=new Color3(.81,.81,.80);
  mat.disableLighting=true;
  mat.backFaceCulling=false;
  mat.specularColor=Color3.Black();
  mat.freeze();
  ground.material=mat;ground.isPickable=true;
  const terrain=new TerrainModule(scene,status=>{
    el('terrain-status').textContent=status;
  });

  // Les raycasts de la scène ne servent qu'aux taps, jamais au glissement.
  scene.skipPointerMovePicking=true;
  const notifyAppUpdate=prepareAppInstallation();
  el('build-revision').textContent='Version '+REVISION+' · '+
    (isNativeApp()?'Application Android de test':'Site / application installable')+
    ' · '+RELEASE_PHASE;
  const camera=new MobileCamera(scene,canvas);
  const resolution=new AdaptiveResolution(engine);
  const materials=createMaterials(scene);
  const surfaces=new SurfaceTileManager(scene,message=>{
    el('surface-status').textContent=message;
  });
  const water=new StableWaterLayer(scene,message=>{
    el('water-status').textContent=message;
  });
  const roads=new MetroRoads(scene,message=>{
    el('roads-status').textContent=message;
  });
  const coverage=new CityCoverage(scene,message=>{
    el('metropole-status').textContent=message;
  });
  let metroCount=0;
  let overviewCount=0;
  let fourthCount=0;
  const showCounts=()=>{
    const total=coverage.buildings;
    counter.textContent=total?
      (total+2696).toLocaleString('fr-FR')+
        ' bâtiments IGN indexés · niveaux de détail':
      (fourthCount+metroCount+overviewCount)
        .toLocaleString('fr-FR')+' volumes rendus · atlas en préparation';
  };
  const manager=new TileManager(scene,materials,(message,count)=>{
    state.textContent=message;
    fourthCount=count;showCounts();
  });
  const overview=new MetroOverview(scene,(message,count)=>{
    overviewCount=count;showCounts();
    el('overview-status').textContent=message;
  },coverage);
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
  const heritage=new HeritageAtlas(scene);
  const urbanAtlas=new UrbanAtlas();
  const quarterOverlay=new QuarterOverlay(scene);
  const quarterButton=el<HTMLButtonElement>('quarter-mode');
  const quarterTools=el<HTMLElement>('quarter-tools');
  const quarterSelect=el<HTMLSelectElement>('quarter-pick');
  const quarterHint=el<HTMLElement>('quarter-hint');
  let quarterMode=false;
  const quarterIndex=new Map<string,QuarterRecord>();
  quarterButton.disabled=true;
  const placeCards=new PlaceCards(el('place-extra'),urbanAtlas);
  const heritageGardens=new HeritageGardenLayer(scene,message=>{
    el('heritage-gardens-status').textContent=message;
  });
  const streets=new StreetDirectory();
  void streets.init();
  let management:GameManagement|null=null;
  let tapSequence=0;
  const clear=()=>{
    management?.clearSelection();
    inspector.begin();
    placeCards.close();
    el('selection').classList.add('hidden');
    el('selection').classList.remove('heritage-selection');
    selection.splice(0).forEach(m=>m.dispose());
  };
  const landmarkBrowser=new LandmarkBrowser(heritage,(ref,x,z)=>{
    const notice=heritage.priorityNotice(ref);
    if(!notice)return;
    clear();
    camera.flyTo(x,z,630);
    el('building-fields').classList.add('hidden');
    el('selection').classList.add('heritage-selection');
    el('selection').classList.remove('hidden');
    el('selection-title').textContent=notice.name;
    heritage.appendDetails(el('place-extra'),null,ref);
    const info=document.createElement('small');
    info.textContent='Point du registre POP : la géométrie architecturale '+
      'exacte de toutes les parties du monument reste à contrôler.';
    el('place-extra').append(info);
    management?.setSelection({id:'patrimoine:'+ref,label:notice.name,
      kind:'lieu',x,z});
    el('selection').scrollTop=0;
  });
  const select=(b:Building)=>{
    clear();
    const coords=centerOfBuilding(b)??{
      x:camera.camera.target.x,z:camera.camera.target.z
    };
    const domain=heritage.identify(coords.x,coords.z);
    const landmark=Boolean(b.heritageName||domain?.kind==='monument');
    el('selection-title').textContent=landmark?
      (b.heritageName??domain?.name??'Monument'):
      'Bâtiment identifié · données IGN';
    // Fiches simples, y compris pour les immeubles ordinaires.
    el('selection').classList.add('heritage-selection');
    el('building-fields').classList.add('hidden');
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
    if(landmark){
      heritage.appendDetails(el('place-extra'),
        domain?.kind==='monument'?domain:null,b.heritageRef,b);
    }else{
      const place=placeCards.show(coords.x,coords.z,
        {kind:'building',building:b});
      el('selection-title').textContent=
        place.urban.street?.name??'Bâtiment et adresse';
    }
    el('selection').scrollTop=0;
    // Aucune option de gestion sur bâtiment dans cette étape.
    management?.clearSelection();
  };
  const showLocation=(x:number,z:number)=>{
    clear();
    const domain=heritage.identify(x,z);
    el('selection-title').textContent=domain?.name??'Fiche du lieu sélectionné';
    el('building-fields').classList.add('hidden');
    el('selection').classList.remove('hidden');
    el('selection').classList.add('heritage-selection');
    if(domain){
      heritage.appendDetails(el('place-extra'),domain);
      management?.clearSelection();
    }else{
      const found=urbanAtlas.identify(x,z);
      const kind=surfaces.identify(x,z)??water.identify(x,z);
      const place=placeCards.show(x,z,{kind:
        found.street?.name?.toLowerCase().startsWith('place ')?'square':
        found.street?'road':
        kind?.kind==='managed'||kind?.kind==='planted'||kind?.kind==='wood'?
        'garden':kind?.kind==='water'?'water':'ground',
        name:found.street?.name});
      el('selection-title').textContent=place.title;
      management?.setSelection({id:'lieu:'+Math.round(x/25)+':'+Math.round(z/25),
        label:place.title,kind:'lieu',x,z});
    }
    el('selection').scrollTop=0;
  };
  const showRoad=(x:number,z:number)=>{
    clear();
    const confirmed=urbanAtlas.identify(x,z);
    const street=confirmed.street?null:streets.nearest(x,z);
    const name=confirmed.street?.name??street?.name??'Voie de Paris';
    el('selection-title').textContent=name;
    el('building-fields').classList.add('hidden');
    el('selection').classList.add('heritage-selection');
    el('selection').classList.remove('hidden');
    placeCards.show(x,z,{kind:confirmed.street?.name?.toLowerCase()
      .startsWith('place ')?'square':'road',name});
    el('selection').scrollTop=0;
    management?.setSelection({id:confirmed.street?
      'voie-officielle:'+confirmed.street.id:street?'voie:'+street.streetId:
      'voirie:'+Math.round(x/25)+':'+Math.round(z/25),
      label:name,kind:'voirie',x,z});
  };
  const showQuarter=(quarter:QuarterRecord,x:number,z:number)=>{
    clear();
    quarterOverlay.show(quarter);
    const key=(quarter.arr??0)+':'+quarter.name;
    quarterSelect.value=key;
    el('building-fields').classList.add('hidden');
    el('selection').classList.add('heritage-selection');
    el('selection').classList.remove('hidden');
    el('selection-title').textContent='Quartier '+quarter.name;
    const root=el('place-extra');
    const brief=document.createElement('section');
    brief.className='quarter-game-card';
    const arr=quarter.arr;
    const stats=document.createElement('p');
    stats.textContent=(typeof arr==='number'&&arr>=1&&arr<=20?
      arr+'e arrondissement · ':'Paris · ')+
      'surface cartographique ≈ '+quarterAreaKm2(quarter).toLocaleString(
       'fr-FR',{maximumFractionDigits:2})+' km²';
    brief.append(stats);
    const note=neighborhoodHistory(quarter.name);
    const history=document.createElement('p');
    history.textContent=note?.summary?.slice(0,220)??
      'Histoire spécifique non encore documentée ; ce contour est administratif.';
    brief.append(history);
    const details=document.createElement('details');
    const heading=document.createElement('summary');
    heading.textContent='Histoire et données du quartier';
    details.append(heading);
    const full=document.createElement('p');
    full.textContent=note?.summary??administrativeParis.summary;
    details.append(full);
    const provenance=document.createElement('a');
    provenance.href=note?.source??administrativeParis.source;
    provenance.textContent='Source historique : '+(note?.label??administrativeParis.label);
    provenance.target='_blank';provenance.rel='noopener noreferrer';
    details.append(provenance);
    const source=document.createElement('a');
    source.href='https://opendata.paris.fr/explore/dataset/quartier_paris/';
    source.textContent='Contour : Ville de Paris (ODbL)';
    source.target='_blank';source.rel='noopener noreferrer';
    details.append(document.createElement('p'),source);
    const missing=document.createElement('p');
    missing.textContent='Population, services et équipements : données locales non encore intégrées. Les dossiers simulés sont accessibles par M.';
    details.append(missing);
    brief.append(details);root.replaceChildren(brief);
    el('selection').scrollTop=0;
    management?.setSelection({id:'quartier:'+key,label:'Quartier '+quarter.name,
      kind:'lieu',x,z});
  };
  const setQuarterMode=(enabled:boolean)=>{
    quarterMode=enabled&&urbanAtlas.quartersReady;
    quarterButton.setAttribute('aria-pressed',String(quarterMode));
    quarterTools.classList.toggle('hidden',!quarterMode);
    quarterButton.title=quarterMode?'Quitter la sélection des quartiers':
      'Choisir un quartier administratif';
    quarterOverlay.clear();
    tapSequence++;clear();
    quarterSelect.value='';
    quarterHint.textContent=quarterMode?
      'Touchez la carte ou choisissez un quartier.':'';
  };
  quarterButton.addEventListener('click',()=>setQuarterMode(!quarterMode));
  quarterSelect.addEventListener('change',()=>{
    const q=quarterIndex.get(quarterSelect.value);
    if(!q)return;
    const anchor=urbanAtlas.quarterAnchors().find(a=>a.name===q.name);
    if(!anchor)return;
    camera.flyTo(anchor.x,anchor.z,1100);
    showQuarter(q,anchor.x,anchor.z);
  });
  const populateQuarters=()=>{
    if(!urbanAtlas.quartersReady){
      quarterHint.textContent='Contours des quartiers non disponibles.';
      return;
    }
    for(const q of [...urbanAtlas.quarterRecords()].sort(
      (a,b)=>(a.arr??0)-(b.arr??0)||a.name.localeCompare(b.name,'fr'))){
      const key=(q.arr??0)+':'+q.name;
      quarterIndex.set(key,q);
      const option=document.createElement('option');
      option.value=key;
      option.textContent=(q.arr??'?')+'e · '+q.name;
      quarterSelect.append(option);
    }
    quarterButton.disabled=false;
    quarterHint.textContent='80 quartiers officiels disponibles.';
  };
  camera.onTap=(x,y)=>{
    const requestId=++tapSequence;
    if(quarterMode){
      const hit=scene.pick(x,y,mesh=>mesh.isPickable&&(
        mesh===ground||mesh.name==='terrain-RGE-ALTI-IGN'||
        Boolean(mesh.metadata)||mesh.name==='infrastructure-road'||
        mesh.name.startsWith('routes-metropole-proches-')));
      let px=hit?.pickedPoint?.x,pz=hit?.pickedPoint?.z;
      if(px===undefined||pz===undefined){
        const ray=scene.createPickingRay(x,y,Matrix.Identity(),camera.camera);
        const scale=Math.abs(ray.direction.y)>1e-6?
          -ray.origin.y/ray.direction.y:NaN;
        px=Number.isFinite(scale)&&scale>0?
          ray.origin.x+scale*ray.direction.x:camera.camera.target.x;
        pz=Number.isFinite(scale)&&scale>0?
          ray.origin.z+scale*ray.direction.z:camera.camera.target.z;
      }
      const quarter=urbanAtlas.quarterAt(px,pz);
      if(quarter)showQuarter(quarter,px,pz);
      else quarterHint.textContent='Aucun quartier administratif à cet endroit.';
      return;
    }
    const hit=scene.pick(x,y,mesh=>mesh.isPickable&&Boolean(mesh.metadata));
    const selected=hit?.pickedMesh&&hit.faceId>=0?
      getPickedBuilding(hit.pickedMesh as Mesh,hit.faceId):null;
    if(selected){select(selected);return;}
    const roadHit=scene.pick(x,y,mesh=>mesh.name==='infrastructure-road'||
      mesh.name.startsWith('routes-metropole-proches-'));
    if(roadHit?.hit&&roadHit.pickedPoint){
      const point=roadHit.pickedPoint;
      if(heritage.identify(point.x,point.z)){
        showLocation(point.x,point.z);return;
      }
      showRoad(point.x,point.z);
      return;
    }
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
    tapSequence++;clear();quarterOverlay.clear();quarterSelect.value='';
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
    roads.setQuality(level);
    metroTrees.setQuality(level);
    trees.setQuality(level);
    if(STABLE_RENDER){
      // Ajustement GPU progressif : uniquement si la chute de FPS dure.
      resolution.configure(level);
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
  let restoredView:GameView|undefined;
  const applySavedView=(view:GameView)=>{
    restoredView=view;
    camera.restoreView(view);
    quality.value=view.quality;
    quality.dispatchEvent(new Event('change'));
    updateCameraButtons();
  };
  management=new GameManagement(clock,selectRate,(x,z)=>camera.flyTo(x,z,340),
    ()=>camera.captureView(quality.value as GameView['quality']),applySavedView);
  window.addEventListener('resize',()=>engine.resize());
  let lastFps=0,lastClock=0,lastAux=0,previous=performance.now();
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
      management?.tickDossiers();
      lastClock=now;
    }
    manager.update(camera.camera.target.x,camera.camera.target.z);
    overview.update(camera.camera.target.x,camera.camera.target.z,
      camera.camera.radius,camera.isMoving);
    metro.update(camera.camera.target.x,camera.camera.target.z,
      camera.camera.radius,camera.isMoving);
    // Les décorations légères ne nécessitent pas de mise à jour à 60 Hz :
    // libérer des cycles CPU pendant le panoramique/zoom sur Android.
    if(!camera.isMoving||now-lastAux>=210){
      roads.update(camera.camera.target.x,camera.camera.target.z,
        camera.camera.radius,camera.isMoving);
      metroTrees.update(camera.camera.target.x,camera.camera.target.z,
        camera.camera.radius,camera.isMoving);
      trees.update(camera.camera.radius,camera.camera.target.x,camera.camera.target.z);
      lastAux=now;
    }
    if(!STABLE_RENDER){
      surfaces.update(camera.camera.target.x,camera.camera.target.z,camera.camera.radius,camera.isMoving);
    }
    scene.render();
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
    // Référentiel vertical officiel d'abord, puis maillages géographiques.
    await terrain.init(ground);
    // La partie peut être restaurée avant le chargement asynchrone du MNT.
    // Réappliquer la focale sauvegardée sur l'altitude réellement chargée.
    if(restoredView!==undefined)camera.restoreView(restoredView);
    else camera.camera.target.y=
      terrainHeight(camera.camera.target.x,camera.camera.target.z);
    await Promise.allSettled([
      inspector.init(),heritageGardens.init(),
      urbanAtlas.init().then(()=>{
         management?.setNeighborhoods(urbanAtlas.quarterAnchors());
         populateQuarters();
       }),
      ...(STABLE_RENDER?[water.init(),roads.init(),trees.init(),metroTrees.init(),
        installSurfaceLayer(scene,'data/metropole/surfaces/green.json',
          message=>{el('surface-status').textContent=message;})]:
        [surfaces.init(),metroTrees.init(),trees.init()]),
      overview.init(),coverage.init().then(()=>showCounts()),
      // Classification patrimoniale avant création des volumes proches.
      heritage.init().then(()=>{
        landmarkBrowser.refresh();
        return Promise.all([metro.init(),manager.init()]);
      }).catch((err:unknown)=>{
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
      // Terrain, végétation et eau disposent désormais de vrais états
      // d'initialisation ; aucun message de substitution n'est affiché.
    }else{
      el('water-status').textContent='Surfaces d’eau IGN : emprises sectorisées';
      el('roads-status').textContent='Chaussées PVP : emprises sectorisées';
    }
    el('places-status').textContent=inspector.monumentCount?
      inspector.monumentCount.toLocaleString('fr-FR')+
      ' notices Mérimée + rues, places, quartiers et adresses au clic':
      'Adresses et POI IGN consultables au clic ; notices Mérimée en préparation';
  })().catch((e:unknown)=>{
    console.warn('Initialisation géographique',e);
    error.textContent=e instanceof Error?e.message:'Initialisation géographique indisponible';
    error.classList.remove('hidden');
  });
  if('caches' in window)
    void window.caches.delete('ortho-4e-images').catch(console.warn);
  if(!isNativeApp()&&'serviceWorker' in navigator)
    void import('virtual:pwa-register').then(({registerSW})=>{
      const updateSW=registerSW({immediate:true,onNeedRefresh:()=>{
       notifyAppUpdate(async()=>{
        await management?.autosave(true);
        await updateSW(true);
       });
      }});
    }).catch(console.warn);
}catch(e){
  error.textContent=e instanceof Error?e.message:'WebGL non disponible';
  error.classList.remove('hidden');
}
