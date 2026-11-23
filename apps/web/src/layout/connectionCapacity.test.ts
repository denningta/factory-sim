import { beforeEach, describe, expect, it } from 'vitest';
import { createEditorStore } from './editorStore';

let store: ReturnType<typeof createEditorStore>;
let id: string;

beforeEach(() => {
  localStorage.clear();
  store = createEditorStore();
  const a = store.getState().placeEquipment('base-workstation', { x: 5, y: 5 })!.id;
  const b = store.getState().placeEquipment('base-workstation', { x: 10, y: 5 })!.id;
  store.getState().connect({ equipmentId: a, portId: 'out' }, { equipmentId: b, portId: 'in' });
  id = store.getState().connections[0]!.id;
});

const capacity = () => store.getState().connections[0]!.capacity;

describe('FL-2 updateConnection capacity', () => {
  it('accepts 0 (no buffer), a positive integer, and null (unlimited)', () => {
    for (const c of [5, null, 0]) {
      expect(store.getState().updateConnection(id, { capacity: c })).toEqual({ ok: true });
      expect(capacity()).toBe(c);
    }
  });

  it('rejects -1 and 1.5 and leaves the connection unchanged', () => {
    store.getState().updateConnection(id, { capacity: 3 });
    for (const bad of [-1, 1.5]) {
      const r = store.getState().updateConnection(id, { capacity: bad });
      expect(r.ok).toBe(false);
      expect(capacity()).toBe(3);
    }
  });

  it('reports an unknown connection', () => {
    expect(store.getState().updateConnection('nope', { capacity: 1 }).ok).toBe(false);
  });

  it('is undoable and redoable', () => {
    store.getState().updateConnection(id, { capacity: 7 });
    store.getState().undo();
    expect(capacity()).toBe(0);
    store.getState().redo();
    expect(capacity()).toBe(7);
  });
});

describe('FL-4 updateConnection transfer', () => {
  const transfer = () => store.getState().connections[0]!.transfer;

  it('accepts instant, fixed time and calculated (speed) transfers', () => {
    for (const t of [
      { kind: 'fixed' as const, time: { kind: 'fixed' as const, value: 4 } },
      { kind: 'speed' as const, speed: 0.5 },
      { kind: 'instant' as const },
    ]) {
      expect(store.getState().updateConnection(id, { transfer: t })).toEqual({ ok: true });
      expect(transfer()).toEqual(t);
    }
  });

  it('rejects a zero speed and a negative time, leaving the connection unchanged', () => {
    const bad = [
      { kind: 'speed' as const, speed: 0 },
      { kind: 'fixed' as const, time: { kind: 'fixed' as const, value: -1 } },
    ];
    for (const t of bad)
      expect(store.getState().updateConnection(id, { transfer: t }).ok).toBe(false);
    expect(transfer()).toEqual({ kind: 'instant' });
  });

  it('is undoable', () => {
    store.getState().updateConnection(id, { transfer: { kind: 'speed', speed: 1 } });
    store.getState().undo();
    expect(transfer()).toEqual({ kind: 'instant' });
  });
});
