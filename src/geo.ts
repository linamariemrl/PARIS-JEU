import type { Point } from './types';
export const CENTER: Point = [2.3537, 48.8545];
const METERS_X = 111320 * Math.cos(CENTER[1] * Math.PI / 180);
const METERS_Z = 111132;
export function project(point: Point) {
  return { x: (point[0] - CENTER[0]) * METERS_X, z: (point[1] - CENTER[1]) * METERS_Z };
}
export function clamp(v: number, a: number, b: number) {
  return Math.min(b, Math.max(a, v));
}
