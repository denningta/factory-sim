import { describe, expect, it } from 'vitest';
import type { RunStats } from '@factory-sim/sim-engine';
import { projectSchema } from '@factory-sim/schema';
import { computeKpis, formatLeadTime } from './kpis';
import { createRunSession } from './runSession';
import modelJson from '../../../../docs/reference-model/model.json';

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

describe('AN-1: Little’s Law on the reference model', () => {
  // docs/reference-model: 2 products (A, B) over 5 stations with buffers and a technician,
  // so WIP and lead time vary and queues form.
  it('WIP ≈ throughput × lead time within 5% for each product and in total, with real WIP', () => {
    const project = projectSchema.parse(modelJson);
    const r = createRunSession(project, { seed: 1, warmUp: 3600, runLength: 8 * 3600 });
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    r.session.runToEnd();
    for (let i = 0; i < 100000 && !r.session.done; i++) r.session.frame(1000);
    const k = computeKpis(r.session.stats(), project.products, 28800);
    expect(k.products.length).toBe(2);
    for (const row of [...k.products, k.total]) {
      expect(row.averageWip, `${row.name} WIP`).toBeGreaterThan(1);
      expect(row.leadTime, `${row.name} lead time`).not.toBeNull();
      const expected = (row.throughputPerHour / 3600) * row.leadTime!;
      expect(Math.abs(row.averageWip - expected) / row.averageWip, row.name).toBeLessThan(0.05);
    }
  });
});

describe('AN-1: warm-up is excluded from the stats window', () => {
  it('the measured window starts at warmUp and counts nothing before it', () => {
    const project = projectSchema.parse(modelJson);
    const r = createRunSession(project, { seed: 1, warmUp: 7200, runLength: 3600 });
    if (!r.ok) throw new Error('model should compile');
    r.session.play();
    while (r.session.now < 3600) r.session.frame(60);
    const during = r.session.stats();
    expect(during.window.from).toBe(7200);
    expect(computeKpis(during, project.products, 28800).total).toMatchObject({
      throughputPerHour: 0,
      averageWip: 0,
      leadTime: null,
    });
  });
});

describe('AN-1: lead time display', () => {
  it('shows seconds below a minute, minutes above, and a dash for none', () => {
    expect(formatLeadTime(5)).toBe('5.0 s');
    expect(formatLeadTime(90)).toBe('1.5 min');
    expect(formatLeadTime(null)).toBe('–');
  });
});
