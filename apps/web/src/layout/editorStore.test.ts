import { beforeEach, describe, expect, it } from 'vitest';
import { createEditorStore, type EquipmentPatch } from './editorStore';
import { fromDisplay } from './units';

let store: ReturnType<typeof createEditorStore>;
beforeEach(() => {
  localStorage.clear();
  store = createEditorStore();
});

describe('editor store', () => {
  it('starts from the schema default floor in meters', () => {
    expect(store.getState().floor).toEqual({ width: 30, length: 20, gridSpacing: 1 });
  });

  it('I can set floor width and length (stored in meters)', () => {
    expect(store.getState().setFloor({ width: fromDisplay(100, 'ft'), length: 40 }).ok).toBe(true);
    expect(store.getState().floor.width).toBeCloseTo(30.48, 10);
    expect(store.getState().floor.length).toBe(40);
  });

  it('rejects invalid floors and leaves the stored floor unchanged', () => {
    const before = store.getState().floor;
    expect(store.getState().setFloor({ width: -3 }).ok).toBe(false);
    expect(store.getState().setFloor({ gridSpacing: 0.001 }).ok).toBe(false); // too many lines
    expect(store.getState().floor).toEqual(before);
  });

  it('switching units never changes the stored geometry', () => {
    store.getState().setFloor({ width: fromDisplay(120, 'ft'), length: fromDisplay(80, 'ft') });
    const before = { ...store.getState().floor };
    for (const u of ['ft', 'm', 'ft', 'm', 'ft'] as const) store.getState().setUnit(u);
    expect(store.getState().floor).toEqual(before);
    expect(store.getState().unit).toBe('ft');
  });

  it('snap can be toggled', () => {
    expect(store.getState().snapEnabled).toBe(true);
    store.getState().toggleSnap();
    expect(store.getState().snapEnabled).toBe(false);
  });

  it('remembers unit and snap in localStorage, never in the document', () => {
    store.getState().setUnit('ft');
    store.getState().toggleSnap();
    const again = createEditorStore();
    expect(again.getState().unit).toBe('ft');
    expect(again.getState().snapEnabled).toBe(false);
    expect(Object.keys(again.getState().floor).sort()).toEqual(['gridSpacing', 'length', 'width']);
  });
});

describe('selected library type (EQ-1)', () => {
  it('starts with nothing selected and records the type to place', () => {
    const store = createEditorStore();
    expect(store.getState().selectedTypeId).toBeNull();
    store.getState().selectType('base-conveyor');
    expect(store.getState().selectedTypeId).toBe('base-conveyor');
    store.getState().selectType(null);
    expect(store.getState().selectedTypeId).toBeNull();
  });

  it('is not persisted with the display preferences', () => {
    localStorage.clear();
    const store = createEditorStore();
    store.getState().selectType('base-sink');
    store.getState().toggleSnap();
    expect(localStorage.getItem('factory-sim:editor-prefs')).not.toContain('base-sink');
  });
});

describe('updateEquipment (WS-1)', () => {
  const placed = () => {
    const s = createEditorStore();
    return { s, e: s.getState().placeEquipment('base-workstation', { x: 4, y: 4 })! };
  };

  it('edits update the stored equipment immediately (name, position, params)', () => {
    const { s, e } = placed();
    expect(s.getState().updateEquipment(e.id, { name: 'Weld 1' }).ok).toBe(true);
    expect(s.getState().updateEquipment(e.id, { position: { x: 7.5 } }).ok).toBe(true);
    expect(s.getState().updateEquipment(e.id, { params: { capacity: 3 } }).ok).toBe(true);
    const got = s.getState().equipment[0]!;
    expect(got.name).toBe('Weld 1');
    expect(got.position).toEqual({ x: 7.5, y: 4 });
    expect(got.params).toEqual({ capacity: 3, batchSize: 1 });
  });

  it('rejects invalid values with a reason and leaves the equipment unchanged', () => {
    const { s, e } = placed();
    const before = s.getState().equipment;
    const bad: EquipmentPatch[] = [
      { params: { capacity: 0 } },
      { params: { capacity: 1.5 } },
      { params: { batchSize: 2 } }, // exceeds capacity 1
      { params: { bogus: 1 } },
      { name: '   ' },
      { position: { x: -1 } },
      { position: { y: 999 } },
      { position: { x: Number.NaN } },
    ];
    for (const patch of bad) {
      const r = s.getState().updateEquipment(e.id, patch);
      expect(r.ok).toBe(false);
      if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
    }
    expect(s.getState().equipment).toBe(before);
  });

  it('explains the batch size rule', () => {
    const { s, e } = placed();
    const r = s.getState().updateEquipment(e.id, { params: { batchSize: 2 } });
    expect(r).toEqual({ ok: false, error: expect.stringMatching(/batch size cannot exceed/i) });
  });

  it('reports off-floor positions as structured bounds in meters', () => {
    const { s, e } = placed();
    expect(s.getState().updateEquipment(e.id, { position: { x: 99 } })).toMatchObject({
      ok: false,
      bounds: { axis: 'x', max: 30 },
    });
    expect(s.getState().updateEquipment(e.id, { position: { y: -1 } })).toMatchObject({
      ok: false,
      bounds: { axis: 'y', max: 20 },
    });
  });

  it('names the batch size field when lowering capacity breaks the rule', () => {
    const { s, e } = placed();
    s.getState().updateEquipment(e.id, { params: { capacity: 3 } });
    s.getState().updateEquipment(e.id, { params: { batchSize: 3 } });
    expect(s.getState().updateEquipment(e.id, { params: { capacity: 1 } })).toMatchObject({
      ok: false,
      field: 'batchSize',
    });
  });
});
