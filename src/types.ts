import type { RoofInfo } from './roofGeometry';
export type Point = [number, number];
export interface CityVolumePart {
  id:string;
  floors:number;
  /** Emprises Paris Data en coordonnées locales métriques (x,z). */
  polygons:Point[][][];
}
export interface CityVolumeGroup {
  coverage:number;
  maxFloors:number;
  parts:CityVolumePart[];
}
export interface Building {
  id: string;
  height: number;
  estimatedHeight: boolean;
  usage: string;
  polygons: Point[][][];
  wallCode?: string;
  roofCode?: string;
  roofInfo?: RoofInfo;
  volumes?: CityVolumeGroup;
  floors?: number;
}
export interface TileInfo { id: string; ix: number; iz: number; count: number; }
export interface Manifest {
  schema: 1;
  tileMeters: number;
  center: Point;
  buildings: number;
  tiles: TileInfo[];
}
export interface TileFile { schema: 1; id: string; buildings: Building[]; }
