import { beforeEach, describe, expect, it } from 'vitest';
import { createEditorStore } from './editorStore';
import { preRunIssues } from '../products/preRunIssues';

let store: ReturnType<typeof createEditorStore>;
const s = () => store.getState();
const out = (equipmentId: string) => ({ equipmentId, portId: 'out' });
const inp = (equipmentId: string) => ({ equipmentId, portId: 'in' });
const ws = (x: number, name: string) => {
  const e = s().placeEquipment('base-workstation', { x, y: 5 })!;
  s().updateEquipment(e.id, { name });
  return e.id;
};
let a1: string, a2: string, buf: string, pid: string, stepId: string;

beforeEach(() => {
  localStorage.clear();
  store = createEditorStore();
  a1 = ws(10, 'Autoclave 1');
  a2 = ws(10.0 + 5, 'Autoclave 2');
  buf = s().placeEquipment('base-buffer', { x: 2, y: 5 })!.id;
  pid = s().addProduct().id;
  stepId = (s().addRoutingStep(pid, a1) as { ok: true; step: { id: string } }).step.id;
});
const step = () => s().products[0]!.routing[0]!;

describe('PS-2 AC2: adding an alternate copies the primary cycle time, marked', () => {
  it('adds the alternate to the step', () => {
    expect(s().addRoutingAlternate(pid, stepId, a2).ok).toBe(true);
    expect(step().alternates).toEqual([a2]);
  });
  it('copies the primary time for that product and marks it copied', () => {
    s().setCycleTime(pid, a1, 90);
    s().addRoutingAlternate(pid, stepId, a2);
    expect(s().cycleTimes.find((c) => c.stationId === a2)?.time).toEqual({
      kind: 'fixed',
      value: 90,
    });
    expect(s().copiedCycleTimes).toContain(`${pid}\u0000${a2}`);
  });
  it('does not overwrite an existing time, and adds none when the primary has none', () => {
    s().setCycleTime(pid, a2, 30);
    s().setCycleTime(pid, a1, 90);
    s().addRoutingAlternate(pid, stepId, a2);
    expect(s().cycleTimes.find((c) => c.stationId === a2)?.time).toEqual({
      kind: 'fixed',
      value: 30,
    });
    expect(s().copiedCycleTimes).toHaveLength(0);
  });
  it('editing the copied time clears the mark', () => {
    s().setCycleTime(pid, a1, 90);
    s().addRoutingAlternate(pid, stepId, a2);
    s().setCycleTime(pid, a2, 100);
    expect(s().copiedCycleTimes).toHaveLength(0);
  });
  it('rejects the primary, a duplicate and non-workstations', () => {
    expect(s().addRoutingAlternate(pid, stepId, a1).ok).toBe(false);
    expect(s().addRoutingAlternate(pid, stepId, buf).ok).toBe(false);
    s().addRoutingAlternate(pid, stepId, a2);
    expect(s().addRoutingAlternate(pid, stepId, a2).ok).toBe(false);
  });
  it('removing an alternate drops it and its cycle time', () => {
    s().setCycleTime(pid, a1, 90);
    s().addRoutingAlternate(pid, stepId, a2);
    s().removeRoutingAlternate(pid, stepId, a2);
    expect(step().alternates ?? []).toEqual([]);
    expect(s().cycleTimes.some((c) => c.stationId === a2)).toBe(false);
  });
});

describe('PS-2 AC3: connecting a same-type sibling offers a parallel station', () => {
  it('offers, and accepting adds it to every step routed to the first station', () => {
    const p2 = s().addProduct().id;
    s().addRoutingStep(p2, a1);
    s().connect(out(buf), inp(a1));
    expect(s().parallelOffer).toBeNull();
    s().connect(out(buf), inp(a2));
    expect(s().parallelOffer).toMatchObject({ stationId: a2, primaryId: a1 });
    s().acceptParallelOffer();
    expect(s().products.map((p) => p.routing[0]!.alternates)).toEqual([[a2], [a2]]);
    expect(s().parallelOffer).toBeNull();
  });
  it('dismissing changes no routing', () => {
    s().connect(out(buf), inp(a1));
    s().connect(out(buf), inp(a2));
    s().dismissParallelOffer();
    expect(s().parallelOffer).toBeNull();
    expect(step().alternates).toBeUndefined();
  });
  it('no offer when the second target is a different type or not routed', () => {
    const rack = s().placeEquipment('base-buffer', { x: 15, y: 9 })!.id;
    s().connect(out(buf), inp(a1));
    s().connect(out(buf), inp(rack));
    expect(s().parallelOffer).toBeNull();
    const a3 = ws(20, 'Other');
    const buf2 = s().placeEquipment('base-buffer', { x: 2, y: 9 })!.id;
    s().connect(out(buf2), inp(a3));
    expect(s().parallelOffer).toBeNull();
  });
});

describe('PS-2 AC4: deleting a station cleans up alternates (ADR-0018)', () => {
  it('removes a deleted alternate from the step', () => {
    s().addRoutingAlternate(pid, stepId, a2);
    s().selectEquipment(a2, false);
    s().deleteSelected();
    expect(step().alternates ?? []).toEqual([]);
    expect(step().stationId).toBe(a1);
  });
  it('promotes the first alternate when the primary is deleted', () => {
    const a3 = ws(20, 'Autoclave 3');
    s().addRoutingAlternate(pid, stepId, a2);
    s().addRoutingAlternate(pid, stepId, a3);
    s().selectEquipment(a1, false);
    s().deleteSelected();
    expect(step().stationId).toBe(a2);
    expect(step().alternates).toEqual([a3]);
  });
});

describe('PS-2 AC5: pre-run checks cover alternates', () => {
  it('reports a missing cycle time at an alternate, naming the station', () => {
    s().setCycleTime(pid, a1, 90);
    s().addRoutingAlternate(pid, stepId, a2);
    s().removeRoutingAlternate(pid, stepId, a2);
    s().addRoutingAlternate(pid, stepId, a2); // copied again…
    const { cycleTimes, ...rest } = s();
    const issues = preRunIssues({
      products: rest.products,
      equipment: rest.equipment,
      technicians: rest.technicians,
      cycleTimes: cycleTimes.filter((c) => c.stationId !== a2),
    });
    expect(issues.find((i) => i.code === 'missing_cycle_times')?.message).toMatch(/Autoclave 2/);
  });
});
