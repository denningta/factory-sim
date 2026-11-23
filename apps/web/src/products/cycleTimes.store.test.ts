import { beforeEach, describe, expect, it } from 'vitest';
import { createProject, projectSchema } from '@factory-sim/schema';
import { createEditorStore } from '../layout/editorStore';
import { preRunIssues } from './preRunIssues';

let store: ReturnType<typeof createEditorStore>;
const s = () => store.getState();
function setup() {
  const mk = (x: number, name: string) => {
    const e = s().placeEquipment('base-workstation', { x, y: 2 })!;
    s().updateEquipment(e.id, { name });
    return e.id;
  };
  const saw = mk(2, 'Saw');
  const cnc = mk(5, 'CNC');
  const p1 = s().addProduct();
  const p2 = s().addProduct();
  s().addRoutingStep(p1.id, saw);
  s().addRoutingStep(p1.id, cnc);
  s().addRoutingStep(p2.id, saw);
  return { saw, cnc, p1, p2 };
}
beforeEach(() => {
  localStorage.clear();
  store = createEditorStore();
});

describe('PR-3 each cell takes a fixed time', () => {
  it('stores a fixed time in seconds and replaces it on the next edit', () => {
    const { saw, p1 } = setup();
    expect(s().setCycleTime(p1.id, saw, 30)).toEqual({ ok: true });
    s().setCycleTime(p1.id, saw, 42);
    expect(s().cycleTimes).toEqual([
      { productId: p1.id, stationId: saw, time: { kind: 'fixed', value: 42 } },
    ]);
  });

  it('clears a cell with null', () => {
    const { saw, p1 } = setup();
    s().setCycleTime(p1.id, saw, 30);
    s().setCycleTime(p1.id, saw, null);
    expect(s().cycleTimes).toEqual([]);
  });

  it('rejects non-positive times and stations outside the routing, leaving the store alone', () => {
    const { cnc, saw, p1, p2 } = setup();
    for (const bad of [0, -1, NaN, Infinity])
      expect(s().setCycleTime(p1.id, saw, bad).ok).toBe(false);
    expect(s().setCycleTime(p2.id, cnc, 10).ok).toBe(false); // p2 doesn't use CNC
    expect(s().setCycleTime('nope', saw, 10).ok).toBe(false);
    expect(s().cycleTimes).toEqual([]);
  });

  it('keeps the document valid against the project schema', () => {
    const { saw, cnc, p1 } = setup();
    s().setCycleTime(p1.id, saw, 30);
    s().setCycleTime(p1.id, cnc, 60);
    const doc = {
      ...createProject(),
      floor: s().floor,
      equipment: s().equipment,
      connections: s().connections,
      products: s().products,
      cycleTimes: s().cycleTimes,
    };
    expect(projectSchema.safeParse(doc).success).toBe(true);
  });
});

describe('PR-3 missing cycle times are flagged before a run', () => {
  it('reports missing_cycle_times until every used cell is filled', () => {
    const { saw, cnc, p1, p2 } = setup();
    const issues = () =>
      preRunIssues({
        products: s().products,
        cycleTimes: s().cycleTimes,
        equipment: s().equipment,
      });
    expect(issues()).toEqual([
      { code: 'missing_cycle_times', message: expect.stringMatching(/3 cycle times.*missing/i) },
    ]);
    expect(issues()[0]!.message).toMatch(/Saw/);
    s().setCycleTime(p1.id, saw, 10);
    s().setCycleTime(p1.id, cnc, 10);
    expect(issues()[0]!.message).toMatch(/1 cycle time\b.*missing/i);
    s().setCycleTime(p2.id, saw, 10);
    expect(issues()).toEqual([]);
  });
});

describe('PR-3 import from CSV / paste from Excel (store)', () => {
  it('applies imported cells as a single undo step', () => {
    const { saw, cnc, p1, p2 } = setup();
    s().setCycleTime(p1.id, saw, 5);
    s().importCycleTimes([
      { productId: p1.id, stationId: saw, seconds: 30 },
      { productId: p1.id, stationId: cnc, seconds: 60 },
      { productId: p2.id, stationId: saw, seconds: 45 },
    ]);
    expect(s().cycleTimes).toHaveLength(3);
    expect(s().cycleTimes.find((c) => c.productId === p1.id && c.stationId === saw)!.time).toEqual({
      kind: 'fixed',
      value: 30,
    });
    s().undo();
    expect(s().cycleTimes).toEqual([
      { productId: p1.id, stationId: saw, time: { kind: 'fixed', value: 5 } },
    ]);
  });
});

describe('PR-3 cycle times live in the editor store and undo history (PR-1 review #81)', () => {
  it('loadDocument loads them and resets history', () => {
    const { saw, p1 } = setup();
    s().setCycleTime(p1.id, saw, 30);
    const doc = {
      ...createProject(),
      floor: s().floor,
      equipment: s().equipment,
      connections: s().connections,
      products: s().products,
      cycleTimes: s().cycleTimes,
    };
    const fresh = createEditorStore();
    fresh.getState().loadDocument(doc);
    expect(fresh.getState().cycleTimes).toEqual(doc.cycleTimes);
    expect(fresh.getState().canUndo).toBe(false);
  });

  it('undoing a product delete restores its cycle times', () => {
    const { saw, p1 } = setup();
    s().setCycleTime(p1.id, saw, 30);
    s().deleteProduct(p1.id);
    expect(s().cycleTimes).toEqual([]);
    s().undo();
    expect(s().cycleTimes).toEqual([
      { productId: p1.id, stationId: saw, time: { kind: 'fixed', value: 30 } },
    ]);
  });

  it('undoes and redoes a cell edit', () => {
    const { saw, p1 } = setup();
    s().setCycleTime(p1.id, saw, 30);
    s().undo();
    expect(s().cycleTimes).toEqual([]);
    s().redo();
    expect(s().cycleTimes).toHaveLength(1);
  });

  it('deleting a station drops the cycle times at it (the document stays valid)', () => {
    const { saw, cnc, p1 } = setup();
    s().setCycleTime(p1.id, saw, 30);
    s().setCycleTime(p1.id, cnc, 60);
    s().selectEquipment(saw, false);
    s().deleteSelected();
    expect(s().cycleTimes.map((c) => c.stationId)).toEqual([cnc]);
    s().undo();
    expect(s().cycleTimes).toHaveLength(2);
  });

  it('removing a routing step drops the cycle time when no other step uses the station', () => {
    const { saw, cnc, p1 } = setup();
    s().setCycleTime(p1.id, saw, 30);
    s().setCycleTime(p1.id, cnc, 60);
    const step = s().products[0]!.routing[1]!;
    s().removeRoutingStep(p1.id, step.id);
    expect(s().cycleTimes.map((c) => c.stationId)).toEqual([saw]);
  });
});
