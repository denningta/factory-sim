import type * as THREE from 'three';

/**
 * Where a pointer ray meets the floor plane (y = 0), as floor-plan meters (three x, z → plan
 * x, y). `ndc` is the pointer in normalized device coordinates. Null if the ray misses.
 */
export function pointerToFloor(
  _camera: THREE.Camera,
  _ndc: { x: number; y: number },
): { x: number; y: number } | null {
  throw new Error('not implemented');
}
