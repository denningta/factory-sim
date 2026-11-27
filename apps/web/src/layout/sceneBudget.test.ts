import { describe, expect, it } from 'vitest';
import { createEditorStore } from './editorStore';
import { groupEquipment, planBatches, triangleCount } from './equipmentGroups';

/** PL-5 target load: 200 objects (ADR-0014). Parts and technicians are instanced separately. */
function load200() {
  const store = createEditorStore();
  const types = ['base-workstation', 'base-buffer', 'base-conveyor', 'base-source', 'base-sink'];
  const protos = types.map((t, i) => store.getState().placeEquipment(t, { x: 2 + i * 6, y: 2 })!);
  return Array.from({ length: 200 }, (_, i) => ({
    ...protos[i % protos.length]!,
    id: `eq-${i}`,
    position: { x: 2 + (i % 20) * 3, y: 2 + Math.floor(i / 20) * 3 },
  }));
}

describe('SF-8 AC3: the scene stays inside the ADR-0014 budget at 200 objects', () => {
  it('draws 200 objects in a few instanced batches: parts share one mesh per material and shape', () => {
    const equipment = load200();
    expect(equipment).toHaveLength(200);
    const groups = groupEquipment(equipment);
    const batches = planBatches(groups);
    expect(batches.length).toBeGreaterThan(0);
    expect(batches.length).toBeLessThanOrEqual(24);
    // Every (group, lod, part) is drawn by exactly one batch.
    const expected = groups.reduce((n, g) => n + g.lods.reduce((m, l) => m + l.length, 0), 0);
    expect(batches.reduce((n, b) => n + b.entries.length, 0)).toBe(expected);
    // A batch is big enough for every item that could land in it.
    for (const b of batches)
      expect(b.capacity).toBe(b.entries.reduce((n, e) => n + groups[e.group]!.items.length, 0));
  });

  it('shows at most 275k triangles with every object at full detail', () => {
    const tris = triangleCount(groupEquipment(load200()));
    expect(tris).toBeGreaterThan(0);
    expect(tris).toBeLessThanOrEqual(275_000);
  });
});
