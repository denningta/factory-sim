import type { Equipment } from '@factory-sim/schema';
import type { Part } from '../equipment/shapes';

export interface EquipmentGroup {
  key: string;
  color: string;
  parts: Part[];
  items: Equipment[];
}

/** Instances sharing a type and the same footprint/height share one set of instanced meshes. */
export function groupEquipment(_equipment: readonly Equipment[]): EquipmentGroup[] {
  throw new Error('not implemented');
}
