import type { Equipment } from '@factory-sim/schema';

/** Ids of equipment whose center lies inside the rectangle spanned by corners a and b. */
export function idsInRect(
  _equipment: readonly Equipment[],
  _a: { x: number; y: number },
  _b: { x: number; y: number },
): string[] {
  throw new Error('not implemented');
}
