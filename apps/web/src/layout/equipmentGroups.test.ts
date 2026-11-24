import { describe, expect, it } from 'vitest';
import { partBounds } from '../equipment/shapes';
import { drawCalls, groupEquipment, partScale } from './equipmentGroups';
import { createEditorStore } from './editorStore';

describe('Clearance checks (LE-5) use the real footprint', () => {
  it('a resized instance is rendered and picked from its own footprint, not its type default', () => {
    const store = createEditorStore();
    const a = store.getState().placeEquipment('base-workstation', { x: 2, y: 2 })!;
    const b = store.getState().placeEquipment('base-workstation', { x: 8, y: 8 })!;
    expect(
      store.getState().updateEquipment(b.id, { footprint: { width: 4, length: 3 }, height: 2 }).ok,
    ).toBe(true);
    const groups = groupEquipment(store.getState().equipment);
    expect(groups).toHaveLength(1);
    const g = groups[0]!;
    const ia = g.items.findIndex((i) => i.id === a.id);
    const ib = g.items.findIndex((i) => i.id === b.id);
    const bb = partBounds(g.itemParts[ib]!);
    expect(bb.max[0]! - bb.min[0]!).toBeCloseTo(4, 9);
    expect(bb.max[2]! - bb.min[2]!).toBeCloseTo(3, 9);
    expect(bb.max[1]).toBeCloseTo(2, 9);
    const ba = partBounds(g.itemParts[ia]!);
    expect(ba.max[0]! - ba.min[0]!).toBeCloseTo(2, 9);
  });

  it('instances with identical settings share one group', () => {
    const store = createEditorStore();
    store.getState().placeEquipment('base-workstation', { x: 2, y: 2 });
    store.getState().placeEquipment('base-workstation', { x: 8, y: 8 });
    expect(groupEquipment(store.getState().equipment)).toHaveLength(1);
  });

  it('same-size instances with different colors render in separate groups', () => {
    const store = createEditorStore();
    store.getState().placeEquipment('base-workstation', { x: 2, y: 2 });
    store.getState().placeEquipment('base-workstation', { x: 8, y: 8 });
    const [a, b] = store.getState().equipment;
    const groups = groupEquipment([a!, { ...b!, color: '#ff0000' }]);
    expect(groups).toHaveLength(2);
    expect(groups.map((g) => g.color).sort()).toEqual([a!.color, '#ff0000'].sort());
  });
});

describe('EQ-5: draw calls per equipment type, not per size', () => {
  const place = (n: number, typeId = 'base-workstation') => {
    const store = createEditorStore();
    store.getState().setFloor({ width: 200, length: 200 });
    for (let i = 0; i < n; i++) {
      const e = store
        .getState()
        .placeEquipment(typeId, { x: 3 + (i % 5) * 6, y: 3 + Math.floor(i / 5) * 6 })!;
      store.getState().updateEquipment(e.id, {
        footprint: { width: 1 + i * 0.1, length: 1 + i * 0.2 },
        height: 1 + i * 0.05,
      });
    }
    return store.getState().equipment;
  };

  it('one InstancedMesh set per type: N instances in N sizes give a constant draw-call count', () => {
    const counts = [1, 5, 20].map((n) => drawCalls(groupEquipment(place(n))));
    expect(new Set(counts).size).toBe(1);
    expect(groupEquipment(place(20))).toHaveLength(1);
  });

  it('two types of many sizes cost one set each', () => {
    const store = createEditorStore();
    store.getState().setFloor({ width: 200, length: 200 });
    for (const t of ['base-workstation', 'base-buffer'])
      for (let i = 0; i < 6; i++) {
        const e = store
          .getState()
          .placeEquipment(t, { x: 3 + i * 6, y: t === 'base-buffer' ? 12 : 3 })!;
        store.getState().updateEquipment(e.id, { footprint: { width: 1 + i * 0.3, length: 1.5 } });
      }
    const groups = groupEquipment(store.getState().equipment);
    expect(groups).toHaveLength(2);
    expect(drawCalls(groups)).toBe(groups[0]!.parts.length + groups[1]!.parts.length);
  });

  it('size is encoded in the instance transform, and each part keeps its own absolute size', () => {
    const eq = place(3);
    const g = groupEquipment(eq)[0]!;
    g.itemParts.forEach((parts) =>
      parts.forEach((p, pi) => {
        const s = partScale(p);
        if (p.shape === 'box') expect(s).toEqual(p.size);
        else expect(s).toEqual([p.radiusBottom, p.height, p.radiusBottom]);
        expect(p.shape).toBe(g.parts[pi]!.shape);
      }),
    );
    // The signal tower (a part that must not stretch with the cabinet) differs per instance.
    expect(partScale(g.itemParts[0]![2]!)).not.toEqual(partScale(g.itemParts[2]![2]!));
  });
});
