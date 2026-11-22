import { beforeEach, describe, expect, it } from 'vitest';
import { equipmentSchema } from '@factory-sim/schema';
import { createEditorStore } from './editorStore';

let store: ReturnType<typeof createEditorStore>;
const s = () => store.getState();
const WORKSTATION = 'base-workstation';
beforeEach(() => {
  localStorage.clear();
  store = createEditorStore();
  s().setFloor({ width: 30, length: 20, gridSpacing: 1 });
});

function place3() {
  const a = s().placeEquipment(WORKSTATION, { x: 2, y: 2 })!;
  const b = s().placeEquipment(WORKSTATION, { x: 6, y: 2 })!;
  const c = s().placeEquipment('base-buffer', { x: 10, y: 8 })!;
  return [a, b, c];
}

describe('place', () => {
  it('Dragging from the library places an object at the cursor, snapped to grid', () => {
    s().setFloor({ gridSpacing: 0.5 });
    const e = s().placeEquipment(WORKSTATION, { x: 3.3, y: 4.8 })!;
    expect(e.position).toEqual({ x: 3.5, y: 5 });
    expect(s().equipment).toHaveLength(1);
  });

  it('does not snap when snap is off', () => {
    s().toggleSnap();
    const e = s().placeEquipment(WORKSTATION, { x: 3.3, y: 4.8 })!;
    expect(e.position).toEqual({ x: 3.3, y: 4.8 });
  });

  it('placed equipment is valid, owns its type settings and has a unique id', () => {
    const [a, b] = place3();
    expect(equipmentSchema.safeParse(a).success).toBe(true);
    expect(a!.id).not.toBe(b!.id);
    expect(a!.typeId).toBe(WORKSTATION);
    expect(a!.rotation).toBe(0);
  });

  it('ids stay unique after a delete', () => {
    place3();
    s().selectEquipment(s().equipment[0]!.id, false);
    s().deleteSelected();
    const e = s().placeEquipment(WORKSTATION, { x: 4, y: 4 })!;
    expect(new Set(s().equipment.map((q) => q.id)).size).toBe(s().equipment.length);
    expect(e).toBeTruthy();
  });

  it('ignores drops off the floor and unknown types', () => {
    expect(s().placeEquipment(WORKSTATION, { x: -2, y: 5 })).toBeNull();
    expect(s().placeEquipment(WORKSTATION, { x: 5, y: 25 })).toBeNull();
    expect(s().placeEquipment('nope', { x: 5, y: 5 })).toBeNull();
    expect(s().equipment).toHaveLength(0);
  });
});

describe('selection', () => {
  it('a plain click selects one; shift-click adds and toggles', () => {
    const [a, b, c] = place3();
    s().selectEquipment(a!.id, false);
    s().selectEquipment(b!.id, true);
    expect(s().selectedIds).toEqual([a!.id, b!.id]);
    s().selectEquipment(a!.id, true);
    expect(s().selectedIds).toEqual([b!.id]);
    s().selectEquipment(c!.id, false);
    expect(s().selectedIds).toEqual([c!.id]);
  });

  it('box select picks everything inside; shift adds to the selection', () => {
    const [a, b, c] = place3();
    s().selectInRect({ x: 0, y: 0 }, { x: 7, y: 3 }, false);
    expect(s().selectedIds).toEqual([a!.id, b!.id]);
    s().selectInRect({ x: 9, y: 7 }, { x: 11, y: 9 }, true);
    expect(s().selectedIds).toEqual([a!.id, b!.id, c!.id]);
  });

  it('box select on empty floor clears the selection; clearSelection works', () => {
    const [a] = place3();
    s().selectEquipment(a!.id, false);
    s().selectInRect({ x: 25, y: 15 }, { x: 28, y: 18 }, false);
    expect(s().selectedIds).toEqual([]);
    s().selectEquipment(a!.id, false);
    s().clearSelection();
    expect(s().selectedIds).toEqual([]);
  });
});

describe('move', () => {
  it('Objects can be moved by drag, snapped to grid', () => {
    const [a] = place3();
    s().selectEquipment(a!.id, false);
    s().dragSelected({ [a!.id]: a!.position }, a!.id, { x: 3.4, y: -0.7 });
    expect(s().equipment[0]!.position).toEqual({ x: 5, y: 1 });
  });

  it('move works on the whole selection and keeps relative offsets', () => {
    const [a, b, c] = place3();
    s().selectEquipment(a!.id, false);
    s().selectEquipment(b!.id, true);
    const starts = { [a!.id]: a!.position, [b!.id]: b!.position };
    s().dragSelected(starts, a!.id, { x: 2.6, y: 1.2 });
    const [na, nb, nc] = s().equipment;
    expect(na!.position).toEqual({ x: 5, y: 3 });
    expect(nb!.position).toEqual({ x: 9, y: 3 });
    expect(nc!.position).toEqual(c!.position); // unselected stays put
  });

  it('is relative to the drag start, so repeated moves do not accumulate', () => {
    const [a] = place3();
    s().selectEquipment(a!.id, false);
    const starts = { [a!.id]: a!.position };
    s().dragSelected(starts, a!.id, { x: 5, y: 5 });
    s().dragSelected(starts, a!.id, { x: 1, y: 0 });
    expect(s().equipment[0]!.position).toEqual({ x: 3, y: 2 });
  });
});

describe('rotate', () => {
  it('rotates in 90° steps, in radians, wrapping at 360°', () => {
    const [a] = place3();
    s().selectEquipment(a!.id, false);
    s().rotateSelected(90);
    expect(s().equipment[0]!.rotation).toBeCloseTo(Math.PI / 2, 9);
    for (let i = 0; i < 3; i++) s().rotateSelected(90);
    expect(s().equipment[0]!.rotation).toBeCloseTo(0, 9);
    s().rotateSelected(-90);
    expect(s().equipment[0]!.rotation).toBeCloseTo((3 * Math.PI) / 2, 9);
  });

  it('rotates to a typed angle in degrees', () => {
    const [a] = place3();
    s().selectEquipment(a!.id, false);
    s().setSelectedRotation(30);
    expect(s().equipment[0]!.rotation).toBeCloseTo(Math.PI / 6, 9);
    s().setSelectedRotation(-90);
    expect(s().equipment[0]!.rotation).toBeCloseTo((3 * Math.PI) / 2, 9);
  });

  it('rotation applies to every selected item only', () => {
    const [a, b, c] = place3();
    s().selectEquipment(a!.id, false);
    s().selectEquipment(c!.id, true);
    s().rotateSelected(90);
    expect(s().equipment.map((e) => e.rotation > 0)).toEqual([true, false, true]);
    expect(b).toBeTruthy();
  });

  it('does nothing for a non-finite angle', () => {
    const [a] = place3();
    s().selectEquipment(a!.id, false);
    s().setSelectedRotation(Number.NaN);
    expect(s().equipment[0]!.rotation).toBe(0);
  });
});

describe('delete', () => {
  it('delete works on the selection and clears it', () => {
    const [a, b, c] = place3();
    s().selectEquipment(a!.id, false);
    s().selectEquipment(c!.id, true);
    s().deleteSelected();
    expect(s().equipment.map((e) => e.id)).toEqual([b!.id]);
    expect(s().selectedIds).toEqual([]);
  });
});

describe('zoom to fit (#57)', () => {
  it('requestFit bumps the tick, and editing the floor does not', () => {
    const before = s().fitTick;
    s().setFloor({ width: 50 });
    expect(s().fitTick).toBe(before);
    s().requestFit();
    expect(s().fitTick).toBe(before + 1);
  });
});
