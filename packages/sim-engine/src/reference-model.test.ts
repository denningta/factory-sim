import { describe, expect, it } from 'vitest';
import { projectSchema } from '@factory-sim/schema';
import { compileLine, createRun, type FlowStats, type RunStats } from './index';
import modelJson from '../../../docs/reference-model/model.json';
import expectedJson from '../../../docs/reference-model/expected.json';

/** `value` with `relTol`/`absTol`, or `min`/`max` bounds (docs/reference-model/README.md). */
interface Check {
  value?: number;
  relTol?: number;
  absTol?: number;
  min?: number;
  max?: number;
}

interface Expected {
  run: { warmUp: number; runLength: number; seed: number };
  seeds: number[];
  throughputPerHour: Record<string, Check>;
  stations: Record<string, Record<string, Check>>;
  techs: Record<string, Record<string, Check>>;
  littlesLaw: { relTol: number };
  bottleneck: string;
}

const expected = expectedJson as Expected;

function assertWithin(actual: number | undefined, check: Check, label: string) {
  expect(actual, label).toBeTypeOf('number');
  const a = actual!;
  if (check.value !== undefined) {
    const tol = check.absTol ?? (check.relTol ?? 0) * Math.abs(check.value);
    expect(
      Math.abs(a - check.value),
      `${label}: ${a} vs ${check.value} ± ${tol}`,
    ).toBeLessThanOrEqual(tol);
  }
  if (check.min !== undefined)
    expect(a, `${label} ≥ ${check.min}`).toBeGreaterThanOrEqual(check.min);
  if (check.max !== undefined) expect(a, `${label} ≤ ${check.max}`).toBeLessThanOrEqual(check.max);
}

function run(seed: number): RunStats {
  const compiled = compileLine(projectSchema.parse(modelJson));
  if (!compiled.ok) throw new Error(JSON.stringify(compiled.issues));
  const r = createRun(compiled.model, { ...expected.run, seed });
  r.setEventsEnabled(false);
  r.runUntil(r.endTime);
  return r.stats();
}

describe('SE-6 AC1: the reference model (docs/reference-model) matches expected.json', () => {
  it.each(expected.seeds)('seed %i', (seed) => {
    const s = run(seed);
    for (const [key, check] of Object.entries(expected.throughputPerHour)) {
      const flow: FlowStats | undefined = key === 'total' ? s.total : s.byProduct[key];
      assertWithin(flow?.throughputPerHour, check, `throughput ${key}`);
    }
    for (const [group, actual] of [
      ['stations', s.stations],
      ['techs', s.techs],
    ] as const)
      for (const [id, states] of Object.entries(expected[group]))
        for (const [state, check] of Object.entries(states))
          assertWithin(
            (actual[id] as Record<string, number> | undefined)?.[state],
            check,
            `${id} ${state}`,
          );

    for (const [key, f] of [['total', s.total], ...Object.entries(s.byProduct)] as const) {
      const little = (f.throughputPerHour / 3600) * f.averageLeadTime;
      expect(Math.abs(f.averageWip - little) / f.averageWip, `Little's law ${key}`).toBeLessThan(
        expected.littlesLaw.relTol,
      );
    }
    const busiest = Object.entries(s.stations).sort((a, b) => b[1].working - a[1].working)[0]![0];
    expect(busiest).toBe(expected.bottleneck);
  });
});
