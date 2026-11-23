import { describe, expect, it } from 'vitest';
import { projectSchema, type Project } from '@factory-sim/schema';
import { compileLine, createRun, type LineEvent, type LineModel, type RunOptions } from './index';
import { fixed, lineProject, type LineSpec } from './line-fixture';

function compile(p: Project): LineModel {
  projectSchema.parse(p); // fixtures must be valid documents
  const c = compileLine(p);
  if (!c.ok) throw new Error(JSON.stringify(c.issues));
  return c.model;
}

function runLine(spec: LineSpec | Project, opts: Partial<RunOptions> = {}) {
  const p = 'schemaVersion' in spec ? spec : lineProject(spec);
  const r = createRun(compile(p), { seed: 1, warmUp: 0, runLength: 3600, ...opts });
  r.runUntil(r.endTime);
  return r;
}

const one = (cycle = 30): LineSpec => ({
  products: ['A'],
  stations: [{ id: 'S1', cycle: { A: fixed(cycle) } }],
});

/** A stochastic two-product, three-station line with finite buffers and shared techs. */
const stochastic = (): LineSpec => ({
  products: ['A', 'B'],
  stations: [
    { id: 'S1', cycle: { A: { kind: 'exponential', mean: 40 }, B: fixed(35) } },
    { id: 'S2', cycle: { A: { kind: 'normal', mean: 50, stdDev: 10 }, B: fixed(30) } },
    {
      id: 'S3',
      cycle: {
        A: { kind: 'triangular', min: 30, mode: 45, max: 70 },
        B: { kind: 'lognormal', mean: 50, stdDev: 15 },
      },
    },
  ],
  linkCapacity: 3,
  interval: { kind: 'exponential', mean: 75 },
  release: { kind: 'random' },
  demand: {
    basis: 'mix',
    items: [
      { productId: 'A', value: 60 },
      { productId: 'B', value: 40 },
    ],
  },
  techs: [
    { id: 'T1', name: 'Tech 1', walkSpeed: 1.2, stationIds: ['S1', 'S2'] },
    { id: 'T2', name: 'Tech 2', walkSpeed: 1.2, stationIds: ['S3'] },
  ],
});

describe('SE-6 AC1: reference model', () => {
  it.todo(
    'runs the 5-station, 2-product reference model and matches expected.json (lands with the lead PR)',
  );
});

describe('SE-6 AC2: same seed and project give identical events and statistics, events on or off', () => {
  let compiled: LineModel | undefined;
  const model = () => (compiled ??= compile(lineProject(stochastic())));
  const opts = { seed: 7, warmUp: 3600, runLength: 8 * 3600 };

  const full = (enabled: boolean) => {
    const r = createRun(model(), opts);
    if (!enabled) r.drainEvents(); // initial states, recorded at createRun
    r.setEventsEnabled(enabled);
    r.runUntil(r.endTime);
    return { events: r.drainEvents(), stats: r.stats() };
  };

  it('repeats events and stats exactly for the same seed', () => {
    const a = full(true);
    const b = full(true);
    expect(a.events.length).toBeGreaterThan(1000);
    expect(b.events).toEqual(a.events);
    expect(b.stats).toEqual(a.stats);
  });

  it('gives the same stats with events disabled, and records none', () => {
    const on = full(true);
    const off = full(false);
    expect(off.events).toEqual([]);
    expect(off.stats).toEqual(on.stats);
  });

  it('gives the same results whether run in slices, by step() or to the end', () => {
    const whole = full(true);
    const sliced = createRun(model(), opts);
    const events: LineEvent[] = [];
    for (let t = 0; !sliced.done; t += 977) {
      sliced.runUntil(t);
      events.push(...sliced.drainEvents());
    }
    expect(events).toEqual(whole.events);
    expect(sliced.stats()).toEqual(whole.stats);

    const stepped = createRun(model(), opts);
    stepped.setEventsEnabled(false);
    while (stepped.step());
    expect(stepped.done).toBe(true);
    expect(stepped.now).toBe(stepped.endTime);
    expect(stepped.stats()).toEqual(whole.stats);
  });

  it('changes with the seed', () => {
    const other = createRun(model(), { ...opts, seed: 8 });
    other.runUntil(other.endTime);
    expect(other.stats()).not.toEqual(full(false).stats);
  });

  it('step() stops at each moment something visible happens', () => {
    const r = createRun(model(), opts);
    let last = -1;
    for (let i = 0; i < 200 && r.step(); i++) {
      const events = r.drainEvents();
      expect(events.length).toBeGreaterThan(0);
      expect(events.every((e) => e.t === r.now)).toBe(true);
      expect(r.now).toBeGreaterThan(last);
      last = r.now;
    }
  });
});

describe('SE-6 AC3: pre-run checks report ModelIssues linked to the object', () => {
  const issues = (p: Project) => {
    const c = compileLine(p);
    return c.ok
      ? []
      : c.issues.map(({ code, objectId, severity }) => ({ code, objectId, severity }));
  };

  it('compiles a valid line with no issues', () => {
    const c = compileLine(lineProject(one()));
    expect(c.ok && c.warnings).toEqual([]);
  });

  it('no products', () => {
    const p = lineProject(one());
    p.products = [];
    p.cycleTimes = [];
    expect(issues(p)).toContainEqual({
      code: 'no_products',
      objectId: undefined,
      severity: 'error',
    });
  });

  it('a routing step with no path', () => {
    const p = lineProject({
      products: ['A'],
      stations: [
        { id: 'S1', cycle: { A: fixed(10) } },
        { id: 'S2', cycle: { A: fixed(10) } },
      ],
    });
    // A third station off the line, reachable from nowhere.
    p.equipment.push({ ...p.equipment.find((e) => e.id === 'S2')!, id: 'S9' });
    p.products[0]!.routing.push({ id: 'A-S9', stationId: 'S9' });
    p.cycleTimes.push({ productId: 'A', stationId: 'S9', time: fixed(5) });
    p.technicians.push({ id: 'T9', name: 'T9', walkSpeed: 1, stationIds: ['S9'] });
    expect(issues(p)).toEqual([{ code: 'no_path', objectId: 'A-S9', severity: 'error' }]);

    // Steps in the wrong order: S2 can't reach S1.
    const q = lineProject({
      products: ['A'],
      stations: [
        { id: 'S1', cycle: { A: fixed(10) } },
        { id: 'S2', cycle: { A: fixed(10) } },
      ],
    });
    q.products[0]!.routing.reverse();
    expect(issues(q).map((i) => i.code)).toContain('no_path');
  });

  it('a manual station without a technician', () => {
    const p = lineProject({ ...one(), techs: false });
    expect(issues(p)).toEqual([
      { code: 'manual_station_without_tech', objectId: 'S1', severity: 'error' },
    ]);
  });

  it('no source, no sink', () => {
    const p = lineProject(one());
    p.equipment = p.equipment.filter((e) => e.behavior !== 'source' && e.behavior !== 'sink');
    p.connections = p.connections.filter((c) => c.id !== 'L0' && c.id !== 'L1');
    const codes = issues(p).map((i) => i.code);
    expect(codes).toContain('no_source');
    expect(codes).toContain('no_sink');
  });

  it('more than one source', () => {
    const p = lineProject(one());
    const src = p.equipment.find((e) => e.id === 'src')!;
    p.equipment.push({ ...src, id: 'src2' });
    expect(issues(p)).toContainEqual({
      code: 'multiple_sources',
      objectId: 'src2',
      severity: 'error',
    });
  });

  it('a routing step without a cycle time', () => {
    const p = lineProject(one());
    p.cycleTimes = [];
    expect(issues(p)).toEqual([
      { code: 'missing_cycle_time', objectId: 'A-S1', severity: 'error' },
    ]);
  });

  it('createRun rejects a model that compileLine did not produce', () => {
    expect(() =>
      createRun({} as unknown as LineModel, { seed: 1, warmUp: 0, runLength: 1 }),
    ).toThrow();
  });
});

describe('SE-6 AC4: statistics exclude the warm-up and satisfy Little’s law', () => {
  it('measures only the window after the warm-up', () => {
    // Release every 60 s at t = 0, 60, …; each part takes 30 s at S1.
    const r = runLine(one(30), { warmUp: 600, runLength: 3600 });
    const s = r.stats();
    expect(s.window).toEqual({ from: 600, to: 4200 });
    expect(s.total.released).toBe(61); // releases at 600, 660, …, 4200
    expect(s.total.completed).toBe(60); // completions at 630, …, 4170
    expect(s.total.throughputPerHour).toBeCloseTo(60, 9);
    expect(s.total.averageLeadTime).toBe(30);
    expect(s.total.averageWip).toBeCloseTo(0.5, 9);
    expect(s.byProduct['A']).toEqual(s.total);
    expect(s.stations['S1']!.working).toBeCloseTo(0.5, 9);
    expect(s.stations['S1']!.starved).toBeCloseTo(0.5, 9);
    expect(s.techs['T-S1']!.working).toBeCloseTo(0.5, 9);
  });

  it('does not count parts released or completed during the warm-up', () => {
    const warm = runLine(one(30), { warmUp: 3600, runLength: 3600 }).stats();
    const cold = runLine(one(30), { warmUp: 0, runLength: 7200 }).stats();
    expect(warm.total.released).toBe(61);
    expect(cold.total.released).toBe(121);
  });

  it('reports an empty window while still in the warm-up', () => {
    const r = createRun(compile(lineProject(one())), { seed: 1, warmUp: 600, runLength: 600 });
    r.runUntil(300);
    const s = r.stats();
    expect(s.window).toEqual({ from: 600, to: 600 });
    expect(s.total.released).toBe(0);
    expect(s.total.throughputPerHour).toBe(0);
    expect(s.total.averageWip).toBe(0);
    expect(s.total.averageLeadTime).toBeNaN();
    expect(s.stations['S1']).toEqual({ working: 0, starved: 0, blocked: 0, idle: 0 });
  });

  it('WIP ≈ throughput × lead time within 5%, per product and in total', () => {
    const r = runLine(stochastic(), { seed: 3, warmUp: 8 * 3600, runLength: 200 * 3600 });
    const s = r.stats();
    for (const f of [s.total, s.byProduct['A']!, s.byProduct['B']!]) {
      expect(f.completed).toBeGreaterThan(1000);
      const little = (f.throughputPerHour / 3600) * f.averageLeadTime;
      expect(Math.abs(f.averageWip - little) / f.averageWip).toBeLessThan(0.05);
    }
    for (const rec of [...Object.values(s.stations), ...Object.values(s.techs)]) {
      const sum = Object.values(rec).reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 9);
    }
  });
});
