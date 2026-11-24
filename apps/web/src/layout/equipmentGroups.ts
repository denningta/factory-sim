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

/**
 * Scale that turns a part's unit geometry into the part at its size: a unit box, or a cylinder
 * of bottom radius 1 and height 1 (top radius = the part's top/bottom ratio, same at any size).
 */
export function partScale(part: Part): [number, number, number] {
  if (part.shape === 'box') return [...part.size];
  return [part.radiusBottom, part.height, part.radiusBottom];
}

/** Draw calls the equipment layer issues: one InstancedMesh per part of each group. */
export function drawCalls(groups: readonly EquipmentGroup[]): number {
  return groups.reduce((n, g) => n + g.parts.length, 0);
}

/**
 * Instances of one type (and color) share one set of instanced meshes whatever their size
 * (ADR-0014). Each instance's parts come from its own settings, so its footprint is the single
 * source for what is drawn and what a pointer can hit; the layer writes them into the instance
 * matrices, so parts that must not stretch (legs, rails, tower) keep their own absolute size.
 */
export function groupEquipment(equipment: readonly Equipment[]): EquipmentGroup[] {
  const groups = new Map<string, EquipmentGroup>();
  for (const e of equipment) {
    const key = `${e.typeId}|${e.color}`;
    const parts = equipmentParts(e);
    const g = groups.get(key) ?? { key, color: e.color, parts, items: [], itemParts: [] };
    g.items.push(e);
    g.itemParts.push(parts);
    groups.set(key, g);
  }
  return [...groups.values()];
}
