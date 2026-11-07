import type { Mesh, Scene } from '@babylonjs/core';
import { createTile } from './buildings';
import type { Manifest, TileFile, TileInfo } from './types';
import type { RoofInfo } from './roofGeometry';
import type { CityVolumeGroup } from './types';
import { shouldUseVolumes } from './volumeGeometry';

const root = import.meta.env.BASE_URL + 'data/4e/';
interface Loaded { meshes: Mesh[]; count: number; }
interface BuildingMaterialRecord {wall?:string;roof?:string;floors?:number;}
interface RoofOverlay {
  schema:number;
  count:number;
  byId:Record<string,RoofInfo>;
}
interface CityVolumeOverlay {
  schema:1;
  officialVolumes:number;
  matchedBuildings:number;
  renderedParts:number;
  byId:Record<string,CityVolumeGroup>;
}
interface MaterialOverlay {
  schema:number;
  totalBuildings:number;
  matchedBuildings:number;
  withWallMaterial:number;
  withRoofMaterial:number;
  byId:Record<string,BuildingMaterialRecord>;
}

/**
 * Mode pilote 4e : les 27 tuiles de bâtiments sont conservées en mémoire.
 * Le zoom, le niveau de qualité et la position de la caméra ne changent
 * JAMAIS le nombre de bâtiments présents dans la scène.
 * À l'échelle de Paris entier, cette règle sera conservée via des LOD
 * géométriques et des représentations de loin, pas par disparition de tuiles.
 */
export class TileManager {
  private manifest: Manifest | null = null;
  private active = new Map<string, Loaded>();
  private failed = new Set<string>();
  private ready = false;
  private overlay:Record<string,BuildingMaterialRecord>={};
  private roofOverlay:Record<string,RoofInfo>={};
  private cityVolumeOverlay:Record<string,CityVolumeGroup>={};

  constructor(
    private scene: Scene,
    private materials: ReturnType<typeof import('./buildings').createMaterials>,
    private onStatus: (message: string, count: number) => void
  ) {}

  async init() {
    const response = await fetch(root + 'manifest.json');
    if (!response.ok) throw new Error('Manifeste des bâtiments IGN indisponible.');
    const manifest = await response.json() as Manifest;
    if (manifest.schema !== 1 || !Array.isArray(manifest.tiles) || !manifest.tiles.length) {
      throw new Error('Manifeste IGN invalide.');
    }
    this.manifest = manifest;
    // Couche séparée par identifiant IGN : les géométries historiques restent intactes.
    try {
      const source = await fetch(root + 'materials.json');
      if(!source.ok){
        const el=document.getElementById('materials-status');
        if(el)el.textContent='Matériaux complémentaires indisponibles';
      }
      if(source.ok){
        const data=await source.json() as MaterialOverlay;
        if(data.schema===1 && data.totalBuildings===manifest.buildings &&
           data.byId && typeof data.byId==='object'){
          this.overlay=data.byId;
          const el=document.getElementById('materials-status');
          if(el)el.textContent =
            data.withWallMaterial.toLocaleString('fr-FR') + ' murs / ' +
            data.withRoofMaterial.toLocaleString('fr-FR') + ' toitures documentés';
        }
      }
    } catch(e) {
      console.warn('Attributs cadastraux optionnels non disponibles',e);
    }
    try {
      const response=await fetch(root+'roof-shapes.json');
      if(!response.ok){
        const status=document.getElementById('roof-status');
        if(status)status.textContent='Formes de toits complémentaires indisponibles';
      }
      if(response.ok){
        const data=await response.json() as RoofOverlay;
        if(data.schema===1&&data.byId&&
           typeof data.byId==='object'&&data.count<=manifest.buildings){
          this.roofOverlay=data.byId;
          const status=document.getElementById('roof-status');
          if(status)status.textContent=data.count.toLocaleString('fr-FR')+
            ' formes de toits documentées OSM';
        }
      }
    }catch(e){console.warn('Formes de toits libres indisponibles',e);}
    // Volumes municipaux réels. En cas d'absence, l'extrusion IGN existante
    // est conservée sans aucun chargement factice ni perte de bâtiments.
    try {
      const result=await fetch(root+'city-volumes.json');
      if(result.ok){
        const data=await result.json() as CityVolumeOverlay;
        if(data.schema===1&&data.byId&&
           data.matchedBuildings<=manifest.buildings){
          this.cityVolumeOverlay=data.byId;
          const count=Object.values(data.byId).filter(v=>
            shouldUseVolumes(v.coverage,v.parts.length,false)
          ).length;
          const element=document.getElementById('volume-status');
          if(element)element.textContent=
            count.toLocaleString('fr-FR')+
            ' bâtiments à étagement municipal détaillé (toits OSM prioritaires)';
        }
      }else{
        const el=document.getElementById('volume-status');
        if(el)el.textContent='Volumétrie municipale complémentaire absente';
      }
    }catch(e){console.warn('Volumes officiels Paris Data indisponibles',e);}
    // Jusqu'à trois téléchargements simultanés sans saturation du téléphone.
    const queue = manifest.tiles.slice();
    const worker = async () => {
      while (queue.length) {
        const info = queue.shift();
        if (!info) break;
        await this.load(info);
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    this.ready = this.failed.size === 0 && this.active.size === manifest.tiles.length;
    this.report();
  }

  // L'échelle graphique peut changer, mais jamais la présence des bâtiments.
  setQuality(_quality: 'low' | 'medium' | 'high') {}
  update(_x: number, _z: number) {}

  private async load(tile: TileInfo) {
    try {
      const response = await fetch(root + 'tiles/' + tile.id + '.json');
      if (!response.ok) throw new Error('Tuile indisponible : ' + tile.id);
      const data = await response.json() as TileFile;
      if (data.schema !== 1 || !Array.isArray(data.buildings) || data.buildings.length !== tile.count) {
        throw new Error('Tuile IGN invalide : ' + tile.id);
      }
      for(const building of data.buildings){
        const documented=this.overlay[building.id];
        if(!documented)continue;
        if(documented.wall)building.wallCode=documented.wall;
        if(documented.roof)building.roofCode=documented.roof;
        if(documented.floors)building.floors=documented.floors;
      }
      for(const building of data.buildings){
        const roof=this.roofOverlay[building.id];
        if(roof)building.roofInfo=roof;
        const volumes=this.cityVolumeOverlay[building.id];
        if(volumes&&shouldUseVolumes(volumes.coverage,volumes.parts.length,
                                    Boolean(building.roofInfo))){
          building.volumes=volumes;
        }
      }
      this.active.set(tile.id, {
        meshes: createTile(this.scene, data, this.materials),
        count: data.buildings.length,
      });
    } catch (e) {
      this.failed.add(tile.id);
      console.warn('Tuile des bâtiments', tile.id, e);
    }
    this.report();
  }

  private report() {
    const count = [...this.active.values()].reduce((n, v) => n + v.count, 0);
    const expected = this.manifest?.buildings ?? 0;
    let status = this.failed.size ? this.failed.size + ' tuile(s) IGN indisponibles' :
      this.ready ? 'Tous les bâtiments du 4e chargés' : 'Chargement intégral des bâtiments IGN…';
    if (expected && !this.ready && !this.failed.size) {
      status += ' ' + count.toLocaleString('fr-FR') + '/' + expected.toLocaleString('fr-FR');
    }
    this.onStatus(status, count);
  }
}
