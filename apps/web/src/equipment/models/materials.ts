import type * as THREE from 'three';
import type { MaterialRole } from './types';

export interface RoleSpec {
  color: string;
  roughness: number;
  metalness: number;
  opacity?: number;
  emissive?: string;
}

export const ROLE_SPECS = {} as Record<MaterialRole, RoleSpec>;

export function roleColor(_role: MaterialRole, _bodyColor: string): string {
  throw new Error('not implemented');
}

export function roleMaterial(_role: MaterialRole): THREE.MeshStandardMaterial {
  throw new Error('not implemented');
}
