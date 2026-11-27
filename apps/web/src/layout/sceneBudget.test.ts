import { describe, expect, it } from 'vitest';
import { createEditorStore } from './editorStore';
import { drawCalls, groupEquipment, triangleCount } from './equipmentGroups';

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
  it('draws 200 objects in the low tens of instanced draw calls, not one per object', () => {
    const equipment = load200();
    expect(equipment).toHaveLength(200);
    const groups = groupEquipment(equipment);
    // One frame shows each instance at one LOD level, so the busiest frame draws the meshes of
    // the most detailed level (empty levels have count 0 and are skipped by three).
    const calls = Math.max(
      ...groups[0]!.lods.map((_, lod) =>
        drawCalls(groups.map((g) => ({ ...g, lods: [g.lods[lod] ?? []] }))),
      ),
    );
    expect(calls).toBeGreaterThan(0);
    expect(calls).toBeLessThanOrEqual(40);
  });

  it('shows at most 275k triangles with every object at full detail', () => {
    const tris = triangleCount(groupEquipment(load200()));
    expect(tris).toBeGreaterThan(0);
    expect(tris).toBeLessThanOrEqual(275_000);
  });
});
