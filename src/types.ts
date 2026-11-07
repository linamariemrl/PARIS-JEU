export type Point = [number, number];
export interface Building {
  id: string;
  height: number;
  estimatedHeight: boolean;
  usage: string;
  polygons: Point[][][];
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
