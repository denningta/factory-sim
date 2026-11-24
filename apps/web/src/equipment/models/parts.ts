import type { ModelPart, Vec3 } from './types';

export function partBounds(_parts: readonly ModelPart[]): { min: Vec3; max: Vec3 } {
  throw new Error('not implemented');
}

export function partTriangles(_part: ModelPart): number {
  throw new Error('not implemented');
}

export function structureKey(_parts: readonly ModelPart[]): string {
  throw new Error('not implemented');
}
