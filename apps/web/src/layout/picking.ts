import * as THREE from 'three';

const GROUND = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

/**
 * Where a pointer ray meets the floor plane (y = 0), as floor-plan meters (three x, z → plan
 * x, y). `ndc` is the pointer in normalized device coordinates. Null if the ray misses.
 */
export function pointerToFloor(
  camera: THREE.Camera,
  ndc: { x: number; y: number },
): { x: number; y: number } | null {
  const ray = new THREE.Raycaster();
  ray.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), camera);
  const hit = ray.ray.intersectPlane(GROUND, new THREE.Vector3());
  return hit ? { x: hit.x, y: hit.z } : null;
}
