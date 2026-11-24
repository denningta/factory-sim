import { describe, expect, it } from 'vitest';
import type { RunStats } from '@factory-sim/sim-engine';
import { computeKpis } from './kpis';
import { createRunSession } from './runSession';
import { currentProject } from './currentProject';
import { useEditorStore } from '../layout/editorStore';

const flow = (completed: number, wip: number, lead: number) => ({
  released: completed,
  completed,
  throughputPerHour: completed,
  averageWip: wip,
  averageLeadTime: lead,
});
const stats = (): RunStats => ({
  window: { from: 0, to: 3600 },
  byProduct: { a: flow(10, 2, 720), b: flow(5, 1, NaN) },
  total: flow(15, 3, 720),
  stations: {},
  techs: {},
});

describe('AN-1: KPI figures', () => {
  it('gives throughput per hour and per shift, WIP and lead time per product and in total', () => {
    const k = computeKpis(
      stats(),
      [
        { id: 'a', name: 'A' },
        { id: 'b', name: 'B' },
      ],
      8 * 3600,
    );
    expect(k.products.map((r) => r.name)).toEqual(['A', 'B']);
    expect(k.products[0]).toMatchObject({ throughputPerHour: 10, averageWip: 2, leadTime: 720 });
    expect(k.products[0]!.throughputPerShift).toBe(80);
    expect(k.total.throughputPerShift).toBe(120);
    expect(k.total.averageWip).toBe(3);
  });

  it('shows no lead time (null) when no part has exited yet', () => {
    const k = computeKpis(stats(), [{ id: 'b', name: 'B' }], 28800);
    expect(k.products[0]!.leadTime).toBeNull();
  });
});

describe('AN-1: Little’s Law on a real run', () => {
  it('WIP ≈ throughput × lead time within 5% (warm-up excluded)', () => {
    useEditorStore.setState(useEditorStore.getInitialState(), true);
    const s = useEditorStore.getState;
    const src = s().placeEquipment('base-source', { x: 0, y: 0 })!;
    const ws = s().placeEquipment('base-workstation', { x: 6, y: 0 })!;
    const sink = s().placeEquipment('base-sink', { x: 12, y: 0 })!;
    s().connect({ equipmentId: src.id, portId: 'out' }, { equipmentId: ws.id, portId: 'in' });
    s().connect({ equipmentId: ws.id, portId: 'out' }, { equipmentId: sink.id, portId: 'in' });
    const p = s().addProduct();
    s().addRoutingStep(p.id, ws.id);
    s().setCycleTime(p.id, ws.id, 5);
    s().setReleaseInterval(4);
    const t = s().addTechnician();
    s().setTechnicianStation(t.id, ws.id, true);
    const r = createRunSession(currentProject(), { seed: 1, warmUp: 3600, runLength: 8 * 3600 });
    if (!r.ok) throw new Error('model should compile');
    r.session.runToEnd();
    for (let i = 0; i < 100000 && !r.session.done; i++) r.session.frame(1000);
    const k = computeKpis(r.session.stats(), s().products, 28800);
    const lead = k.total.leadTime!;
    expect(lead).toBeGreaterThan(0);
    const expected = (k.total.throughputPerHour / 3600) * lead;
    expect(Math.abs(k.total.averageWip - expected) / k.total.averageWip).toBeLessThan(0.05);
  });
});
