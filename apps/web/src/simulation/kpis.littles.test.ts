import { describe, expect, it } from 'vitest';
import { projectSchema } from '@factory-sim/schema';
import { computeKpis, littlesLaw, type KpiRow } from './kpis';
import { createRunSession } from './runSession';
import modelJson from '../../../../docs/reference-model/model.json';

const row = (wip: number, perHour: number, lead: number | null): KpiRow => ({
  id: 'total',
  name: 'Total',
  throughputPerHour: perHour,
  throughputPerShift: perHour * 8,
  averageWip: wip,
  leadTime: lead,
});

describe("UI-6 AC2: Little's Law check", () => {
  it('passes on the reference model', () => {
    const project = projectSchema.parse(modelJson);
    const r = createRunSession(project, { seed: 1, warmUp: 3600, runLength: 24 * 3600 });
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    r.session.runToEnd();
    for (let i = 0; i < 100000 && !r.session.done; i++) r.session.frame(1000);
    const k = computeKpis(r.session.stats(), project.products, 28800);
    expect(littlesLaw(k.total).ok).toBe(true);
  });

  it('passes when WIP is within 5% of throughput × lead time, fails beyond it', () => {
    // 3600 units/h × 10 s = 10 units
    expect(littlesLaw(row(10.4, 3600, 10)).ok).toBe(true);
    expect(littlesLaw(row(10.6, 3600, 10)).ok).toBe(false);
    expect(littlesLaw(row(9.4, 3600, 10)).ok).toBe(false);
    expect(littlesLaw(row(10, 3600, 10))).toMatchObject({ expectedWip: 10, deviation: 0 });
  });

  it('has no verdict until a part has exited', () => {
    expect(littlesLaw(row(0, 0, null)).ok).toBeNull();
    expect(littlesLaw(row(2, 0, null)).ok).toBeNull();
  });
});
