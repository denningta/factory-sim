/**
 * SE-2 performance target: a one-week run of a 20-station model in under 30 s.
 * Skipped in `pnpm test`/CI (timing depends on the machine); run with
 * `BENCH=1 pnpm --filter @factory-sim/sim-engine test -- line.perf`.
 */
import { expect, it } from 'vitest';
import { compileLine, createRun } from './index';
import { fixed, lineProject, type StationSpec } from './line-fixture';

const stations: StationSpec[] = Array.from({ length: 20 }, (_, i) => ({
  id: `S${i + 1}`,
  cycle: {
    A: { kind: 'normal', mean: 40 + (i % 5), stdDev: 4 },
    B: { kind: 'triangular', min: 30, mode: 40, max: 55 },
  },
  ...(i % 4 === 1 && { labor: { mode: 'automatic', loadTime: fixed(3), unloadTime: fixed(3) } }),
}));
const project = lineProject({
  products: ['A', 'B'],
  stations,
  linkCapacity: 0,
  inserts: Object.fromEntries(stations.map((_, i) => [i, { buffer: 3 }])),
  interval: { kind: 'exponential', mean: 45 },
  release: { kind: 'random' },
});

// The package has no Node types; read the variable without them.
const env = (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env;

it.skipIf(!env?.['BENCH'])(
  'runs one week of a 20-station line, events on, in under 30 s',
  () => {
    const started = Date.now();
    const c = compileLine(project);
    if (!c.ok) throw new Error(JSON.stringify(c.issues));
    const run = createRun(c.model, { seed: 1, warmUp: 0, runLength: 7 * 24 * 3600 });
    let events = 0;
    while (!run.done) {
      run.runUntil(run.now + 3600);
      events += run.drainEvents().length;
    }
    const seconds = (Date.now() - started) / 1000;
    expect(run.stats().total.completed).toBeGreaterThan(10_000);
    expect(seconds, `${seconds} s, ${events} events`).toBeLessThan(30);
  },
  60_000,
);
