import type { Equipment } from '@factory-sim/schema';
import { equipmentParts, type Part } from '../equipment/shapes';

export interface EquipmentGroup {
  key: string;
  color: string;
  parts: Part[];
  items: Equipment[];
}

/**
 * Instances sharing a type and the same footprint/height share one set of instanced meshes.
 * Parts come from the instance's own settings, so its footprint is the single source for what
 * is drawn and what a pointer can hit.
 */
export function groupEquipment(equipment: readonly Equipment[]): EquipmentGroup[] {
  const groups = new Map<string, EquipmentGroup>();
  for (const e of equipment) {
    const key = `${e.typeId}|${e.footprint.width}|${e.footprint.length}|${e.height}|${e.color}`;
    const g = groups.get(key) ?? { key, color: e.color, parts: equipmentParts(e), items: [] };
    g.items.push(e);
    groups.set(key, g);
  }
  return [...groups.values()];
}
