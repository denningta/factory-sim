import * as THREE from 'three';
import { partScale } from '../../layout/equipmentGroups';
import type { ModelPart } from './types';

const UP = new THREE.Vector3(0, 1, 0);
const dummy = new THREE.Object3D();
const offset = new THREE.Vector3();
const LIE_ALONG_Z = new THREE.Quaternion().setFromAxisAngle(
  new THREE.Vector3(1, 0, 0),
  Math.PI / 2,
);
const plan = new THREE.Quaternion();

/**
 * Writes one part of one placed item into slot `slot` of its instanced mesh. Geometry is unit
 * size, so the part's size lives in the matrix; `at` is the item's plan position and rotation.
 */
export function writePartMatrix(
  mesh: THREE.InstancedMesh,
  slot: number,
  part: ModelPart,
  at: { x: number; y: number; rotation: number },
) {
  offset.set(...part.position).applyAxisAngle(UP, -at.rotation);
  dummy.position.set(at.x + offset.x, offset.y, at.y + offset.z);
  // Plan angle runs x→y, which is -y in three. A vessel is turned onto its side first (+90°
  // about x maps the cylinder's +y end to +z).
  plan.setFromAxisAngle(UP, -at.rotation);
  if (part.shape === 'cylinder' && part.axis === 'z') plan.multiply(LIE_ALONG_Z);
  dummy.quaternion.copy(plan);
  dummy.scale.set(...partScale(part));
  dummy.updateMatrix();
  mesh.setMatrixAt(slot, dummy.matrix);
}
