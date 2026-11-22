import { describe, expect, it } from 'vitest';
import { partBounds } from '../equipment/shapes';
import { groupEquipment } from './equipmentGroups';
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
    expect(groups).toHaveLength(2);
    const ga = groups.find((g) => g.items.some((i) => i.id === a.id))!;
    const gb = groups.find((g) => g.items.some((i) => i.id === b.id))!;
    const bb = partBounds(gb.parts);
    expect(bb.max[0]! - bb.min[0]!).toBeCloseTo(4, 9);
    expect(bb.max[2]! - bb.min[2]!).toBeCloseTo(3, 9);
    expect(bb.max[1]).toBeCloseTo(2, 9);
    const ba = partBounds(ga.parts);
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
