import type { Equipment } from '@factory-sim/schema';
import { equipmentParts, type Part } from '../equipment/shapes';

export interface EquipmentGroup {
  key: string;
  color: string;
  /** Parts of the first item; the shape (part count, kinds) is shared by every item. */
  parts: Part[];
  items: Equipment[];
  /** Per item, its parts at its own size, in `items` order. */
  itemParts: Part[][];
}

/** Scale that turns a part's unit geometry (see `unitGeometry`) into the part at its size. */
export function partScale(part: Part): [number, number, number] {
  throw new Error('not implemented ' + part.shape);
}

/** Draw calls the equipment layer issues: one InstancedMesh per part of each group. */
export function drawCalls(groups: readonly EquipmentGroup[]): number {
  throw new Error('not implemented ' + groups.length);
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
    const g = groups.get(key) ?? { key, color: e.color, parts: equipmentParts(e), items: [], itemParts: [] };
    g.items.push(e);
    groups.set(key, g);
  }
  return [...groups.values()];
}
