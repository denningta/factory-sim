import type * as THREE from 'three';
export const ARC_CLEARANCE = 0.5;
export type ArcInput = {
  id: string;
  from: { x: number; y: number; z: number };
  to: { x: number; y: number; z: number };
  top: number;
};
export type ArcRange = { id: string; start: number; count: number };
export const arcPath = (_a: ArcInput): THREE.Vector3[] => {
  throw new Error('not implemented');
};
export const buildArcs = (
  _a: ArcInput[],
): { geometry: THREE.BufferGeometry; ranges: ArcRange[] } => {
  throw new Error('not implemented');
};
export const connectionAtVertex = (_r: ArcRange[], _v: number): string | null => {
  throw new Error('not implemented');
};
export const paintArcs = (
  _g: THREE.BufferGeometry,
  _r: ArcRange[],
  _c: Map<string, { color: string; flowing: boolean }>,
): boolean => {
  throw new Error('not implemented');
};
