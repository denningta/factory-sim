import { beforeEach, describe, expect, it } from 'vitest';
import { createEditorStore } from './editorStore';
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
