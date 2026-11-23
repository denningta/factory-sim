import { describe, expect, it } from 'vitest';
import { createProject, type Project } from '@factory-sim/schema';
import { compileLine, createRun } from '@factory-sim/sim-engine';
import { createEditorStore } from '../layout/editorStore';

/** A real source → workstation → sink line, with the release rule and demand set via the store. */
function releasedShares(setup: (s: ReturnType<typeof createEditorStore>['getState']) => void) {
  const store = createEditorStore();
  const s = store.getState;
  const src = s().placeEquipment('base-source', { x: 0, y: 0 })!;
  const ws = s().placeEquipment('base-workstation', { x: 4, y: 0 })!;
  const sink = s().placeEquipment('base-sink', { x: 8, y: 0 })!;
  s().connect({ equipmentId: src.id, portId: 'out' }, { equipmentId: ws.id, portId: 'in' });
  s().connect({ equipmentId: ws.id, portId: 'out' }, { equipmentId: sink.id, portId: 'in' });
  const [a, b] = [s().addProduct(), s().addProduct()];
  for (const p of [a, b]) {
    s().addRoutingStep(p.id, ws.id);
    s().setCycleTime(p.id, ws.id, 1);
  }
  const tech = s().addTechnician();
  s().setTechnicianStation(tech.id, ws.id, true);
  s().setDemandValue(a.id, 60);
  setup(s);
  const st = s();
  const project: Project = {
    ...createProject(),
    floor: st.floor,
    equipment: st.equipment,
    connections: st.connections,
    products: st.products,
    cycleTimes: st.cycleTimes,
    technicians: st.technicians,
    demand: st.demand,
    release: st.release,
  };
  const c = compileLine(project);
  if (!c.ok) throw new Error(c.issues.map((i) => i.message).join('; '));
  const run = createRun(c.model, { seed: 3, warmUp: 0, runLength: 200_000 });
  run.runUntil(run.endTime);
  const by = run.stats().byProduct;
  const total = by[a.id]!.released + by[b.id]!.released;
  return { a: by[a.id]!.released / total, b: by[b.id]!.released / total, total };
}

describe('PR-4 AC3: over a long run released quantities match the mix within 2%', () => {
  it('fixed interval (smooth order)', () => {
    const r = releasedShares((s) => s().setReleaseMode('fixed'));
    expect(r.total).toBeGreaterThan(1000);
    expect(Math.abs(r.a - 0.6)).toBeLessThanOrEqual(0.02);
    expect(Math.abs(r.b - 0.4)).toBeLessThanOrEqual(0.02);
  });
  it('random by mix', () => {
    const r = releasedShares((s) => s().setReleaseMode('random'));
    expect(Math.abs(r.a - 0.6)).toBeLessThanOrEqual(0.02);
  });
  it('repeating sequence A A B A B', () => {
    const r = releasedShares((s) => {
      s().setReleaseMode('sequence');
      const [a, b] = s().products;
      s().setReleasePattern([a!.id, a!.id, b!.id, a!.id, b!.id]);
    });
    expect(Math.abs(r.a - 0.6)).toBeLessThanOrEqual(0.02);
  });
});
