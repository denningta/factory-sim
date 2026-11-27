import type { Equipment } from '@factory-sim/schema';
import { structureKey } from '../equipment/models/parts';
import { buildModel } from '../equipment/models/registry';
import type { ModelDefinition, ModelPart } from '../equipment/models/types';

export interface EquipmentGroup {
  /** The model id, plus its part structure in the rare case params change it. */
  key: string;
  model: ModelDefinition;
  /** Parts of the first item per LOD; the structure is shared by every item. */
  lods: ModelPart[][];
  items: Equipment[];
  /** Per item, per LOD, its parts at its own size, in `items` order. */
  itemLods: ModelPart[][][];
}

/**
 * Scale that turns a part's unit geometry into the part at its size: a unit box, or a cylinder
 * of bottom radius 1 and height 1 (top radius = the part's top/bottom ratio, same at any size).
 */
export function partScale(part: ModelPart): [number, number, number] {
  if (part.shape === 'box') return [...part.size];
  return [part.radiusBottom, part.height, part.radiusBottom];
}

/**
 * Args for the unit geometry of a part's InstancedMesh; `partScale` then sizes each instance.
 * Box: unit cube. Cylinder: bottom radius 1, height 1, top radius = the part's top/bottom ratio.
 * That ratio is part of the group key (`structureKey`), so it is the same for every instance.
 */
export type UnitGeometry =
  | { shape: 'box'; args: [number, number, number] }
  | { shape: 'cylinder'; args: [number, number, number, number] };

export function unitGeometryArgs(part: ModelPart): UnitGeometry {
  if (part.shape === 'box') return { shape: 'box', args: [1, 1, 1] };
  return {
    shape: 'cylinder',
    args: [part.radiusTop / part.radiusBottom, 1, 1, part.segments],
  };
}

/** Instanced meshes the equipment layer creates: one per part of each LOD of each group. */
export function drawCalls(groups: readonly EquipmentGroup[]): number {
  return groups.reduce((n, g) => n + g.lods.reduce((m, l) => m + l.length, 0), 0);
}

/** LOD level for a camera distance: past `distances[k]`, level k + 1. */
export function lodForDistance(distances: readonly number[], d: number): number {
  let lod = 0;
  while (lod < distances.length && d > distances[lod]!) lod++;
  return lod;
}

/** Item indices per LOD level, each in item order. */
export function splitByLod(
  count: number,
  lodOf: (i: number) => number,
  levels: number,
): number[][] {
  const out: number[][] = Array.from({ length: levels }, () => []);
  for (let i = 0; i < count; i++) out[lodOf(i)]!.push(i);
  return out;
}

/**
 * Instances that draw the same model share one set of instanced meshes per LOD whatever their
 * type, size or color (ADR-0014, ADR-0015); color is a per-instance tint. Each instance's parts
 * come from its own settings, so its footprint is the single source for what is drawn and what
 * a pointer can hit. The layer writes them into the instance matrices, so fixed parts (legs,
 * rails, pole) keep their real size.
 */
export function groupEquipment(equipment: readonly Equipment[]): EquipmentGroup[] {
  const groups = new Map<string, EquipmentGroup>();
  for (const e of equipment) {
    const { model, lods } = buildModel(e);
    const key = `${model.id}|${lods.map(structureKey).join('/')}`;
    const g = groups.get(key) ?? { key, model, lods, items: [], itemLods: [] };
    g.items.push(e);
    g.itemLods.push(lods);
    groups.set(key, g);
  }
  return [...groups.values()];
}

/** Triangles in one part: 12 for a box, 4 per radial segment for a capped cylinder. */
function partTriangles(part: ModelPart): number {
  return part.shape === 'box' ? 12 : 4 * part.segments;
}

/** Triangles drawn if every instance showed LOD 0 (an upper bound; LOD only lowers it). */
export function triangleCount(groups: readonly EquipmentGroup[]): number {
  let n = 0;
  for (const g of groups)
    for (const lods of g.itemLods) n += lods[0]!.reduce((sum, p) => sum + partTriangles(p), 0);
  return n;
}

/** One part of one LOD level of one group; the unit a batch draws. */
export interface BatchEntry {
  group: number;
  lod: number;
  part: number;
}

/** Parts that share a role (material) and unit geometry, drawn as one InstancedMesh. */
export interface Batch {
  key: string;
  role: ModelPart['role'];
  /** A part to build the unit geometry from; every entry's part has the same one. */
  sample: ModelPart;
  entries: BatchEntry[];
  /** Slots needed if every item sat at every entry (items sit at one LOD, so this is an upper bound). */
  capacity: number;
}

/**
 * Groups parts across models and LOD levels by (role, unit geometry) so the draw-call count
 * follows the number of materials and shapes, not the number of models and parts (ADR-0014).
 */
export function planBatches(_groups: readonly EquipmentGroup[]): Batch[] {
  throw new Error('not implemented');
}
