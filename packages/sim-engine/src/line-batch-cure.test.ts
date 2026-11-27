import type { Duration } from '@factory-sim/schema';
import { describe, expect, it } from 'vitest';
import { compileLine, createRun, type LineEvent } from './index';
import { fixed, lineProject, type LineSpec, type StationSpec } from './line-fixture';

/** SF-6: a workstation that cures a batch for a fixed time (ADR-0017). */
function run(
  station: Partial<StationSpec>,
  opts: { interval?: Duration; products?: string[]; seed?: number; runLength?: number } = {},
) {
  const products = opts.products ?? ['A'];
  const spec: LineSpec = {
    products,
    stations: [
      {
        id: 'S1',
        cycle: Object.fromEntries(products.map((p) => [p, fixed(1)])),
        capacity: 3,
        batchSize: 3,
        cure: fixed(100),
        ...station,
      },
    ],
    interval: opts.interval ?? fixed(10),
  };
  const c = compileLine(lineProject(spec));
  if (!c.ok) throw new Error(JSON.stringify(c.issues));
  const r = createRun(c.model, {
    seed: opts.seed ?? 1,
    warmUp: 0,
    runLength: opts.runLength ?? 3600,
  });
  r.runUntil(r.endTime);
  return { stats: r.stats(), events: r.drainEvents() };
}

const of = <T extends LineEvent['type']>(events: LineEvent[], type: T) =>
  events.filter((e): e is Extract<LineEvent, { type: T }> => e.type === type);

const AUTOMATIC = {
  mode: 'automatic',
  loadTime: fixed(5),
  unloadTime: fixed(7),
} as const;

describe("SF-6 AC1: cycle.mode = 'perBatch'", () => {
  it('needs no cycleTimes entries: no missing_cycle_time issue', () => {
    const p = lineProject({
      products: ['A', 'B'],
      stations: [{ id: 'S1', cycle: { A: fixed(1), B: fixed(1) }, cure: fixed(100) }],
    });
    expect(p.cycleTimes).toEqual([]);
    const c = compileLine(p);
    expect(c.ok ? [] : c.issues).toEqual([]);
  });

  it('a perProduct station still reports a missing cycle time', () => {
    const p = lineProject({ products: ['A'], stations: [{ id: 'S1', cycle: { A: fixed(1) } }] });
    p.cycleTimes = [];
    const c = compileLine(p);
    expect(c.ok ? [] : c.issues.map((i) => i.code)).toEqual(['missing_cycle_time']);
  });

  it('cure time is independent of batch size', () => {
    for (const batchSize of [1, 2, 4]) {
      const { events } = run({ batchSize, capacity: 4 }, { interval: fixed(50) });
      const batches = of(events, 'batchStarted');
      expect(batches.length).toBeGreaterThan(5);
      for (const b of batches) {
        expect(b.partIds).toHaveLength(batchSize);
        expect(b.endsAt - b.t).toBe(100);
      }
    }
  });

  it('cure time is the same for full and partial batches', () => {
    // Irregular arrivals and maxWait 20 give a mix of full and partial batches.
    const { events } = run(
      { maxWait: 20, cure: fixed(5) },
      { interval: { kind: 'normal', mean: 12, stdDev: 6 } },
    );
    const batches = of(events, 'batchStarted');
    const sizes = new Set(batches.map((b) => b.partIds.length));
    expect(sizes.has(3) && (sizes.has(1) || sizes.has(2))).toBe(true);
    for (const b of batches) expect(b.endsAt - b.t).toBe(5);
  });

  it('cure time is independent of product mix (mixed batches cure for cycle.time)', () => {
    const { events } = run(
      { batchSize: 3, capacity: 6 },
      { products: ['A', 'B'], interval: fixed(50) },
    );
    const product = new Map(of(events, 'partReleased').map((e) => [e.partId, e.productId]));
    const batches = of(events, 'batchStarted');
    const mixes = batches.map((b) => b.partIds.map((id) => product.get(id)).join(''));
    expect(mixes.slice(0, 2)).toEqual(['ABA', 'BAB']);
    for (const b of batches) expect(b.endsAt - b.t).toBe(100);
    for (const s of of(events, 'partStarted')) expect(s.endsAt! - s.t).toBe(100);
  });
});

describe('SF-6 AC2: maxWait', () => {
  it('a partial batch starts once the first waiting part has waited maxWait', () => {
    // Parts arrive every 60 s, batch of 3, maxWait 50: each part starts alone 50 s after it arrives.
    const { events } = run({ maxWait: 50, cure: fixed(10) }, { interval: fixed(60) });
    const batches = of(events, 'batchStarted');
    expect(batches.slice(0, 3).map((b) => [b.t, b.partIds.length, b.endsAt])).toEqual([
      [50, 1, 60],
      [110, 1, 120],
      [170, 1, 180],
    ]);
  });

  it('starts every waiting part when the timer fires (a partial batch of 2)', () => {
    // Arrivals at 0, 40, 80…; maxWait 50 → parts 0 and 40 start together at 50.
    const { events } = run({ maxWait: 50, cure: fixed(10) }, { interval: fixed(40) });
    const first = of(events, 'batchStarted')[0]!;
    expect([first.t, first.partIds.length]).toEqual([50, 2]);
  });

  it('a full batch starts at once and cancels the timer', () => {
    // Arrivals every 10 s, maxWait 25: batches fill at 20, 50, 80 before the timer (25, 55…).
    const { events } = run({ maxWait: 25, cure: fixed(5) }, { interval: fixed(10) });
    const batches = of(events, 'batchStarted');
    expect(batches.slice(0, 3).map((b) => [b.t, b.partIds.length])).toEqual([
      [20, 3],
      [50, 3],
      [80, 3],
    ]);
    expect(batches.every((b) => b.partIds.length === 3)).toBe(true);
  });

  it('without maxWait only full batches start (unchanged behavior)', () => {
    const { events } = run({ cure: fixed(10) }, { interval: fixed(60) });
    const batches = of(events, 'batchStarted');
    expect(batches[0]!.t).toBe(120);
    expect(batches.every((b) => b.partIds.length === 3)).toBe(true);
  });
});

describe('SF-6 AC3: batchStarted, batchFinished and partFinished events', () => {
  it('manual station: batchStarted with endsAt, batchFinished at endsAt, partFinished per part', () => {
    const { events } = run({}, { interval: fixed(10) });
    const [b] = of(events, 'batchStarted');
    expect(b).toEqual({
      t: 20,
      type: 'batchStarted',
      equipmentId: 'S1',
      partIds: [1, 2, 3],
      endsAt: 120,
    });
    expect(of(events, 'batchFinished')[0]).toEqual({
      t: 120,
      type: 'batchFinished',
      equipmentId: 'S1',
      partIds: [1, 2, 3],
    });
    const finished = of(events, 'partFinished').slice(0, 3);
    expect(finished).toEqual(
      [1, 2, 3].map((partId) => ({ t: 120, type: 'partFinished', partId, equipmentId: 'S1' })),
    );
  });

  it('automatic station: batchStarted after the load, with endsAt', () => {
    const { events } = run({ labor: AUTOMATIC }, { interval: fixed(10) });
    const [b] = of(events, 'batchStarted');
    expect(b).toMatchObject({ t: 25, partIds: [1, 2, 3], endsAt: 125 });
    expect(of(events, 'batchFinished')[0]).toMatchObject({ t: 125, partIds: [1, 2, 3] });
  });

  it('partFinished follows every processed part; a single-part station has no batch events', () => {
    const { events } = run({ batchSize: 1, capacity: 1, cure: undefined }, { interval: fixed(10) });
    expect(of(events, 'batchStarted')).toEqual([]);
    expect(of(events, 'batchFinished')).toEqual([]);
    const started = of(events, 'partStarted');
    const finished = of(events, 'partFinished');
    expect(finished.length).toBeGreaterThan(100);
    expect(finished.map((e) => e.partId)).toEqual(
      started.slice(0, finished.length).map((e) => e.partId),
    );
    // A part's finish comes before it moves on.
    const idx = (type: string, id: number) =>
      events.findIndex((e) => e.type === type && 'partId' in e && e.partId === id);
    expect(idx('partFinished', 1)).toBeLessThan(idx('partExited', 1));
  });

  it('a perProduct batch station (batchSize > 1) also emits batch events', () => {
    const { events } = run({ cure: undefined, cycle: { A: fixed(30) } }, { interval: fixed(10) });
    expect(of(events, 'batchStarted')[0]).toMatchObject({ t: 20, endsAt: 50 });
  });
});

describe('SF-6 AC4: load and unload stay once per batch (automatic labor)', () => {
  it('one load before and one unload after the cure, for the whole batch', () => {
    const { events, stats } = run({ labor: AUTOMATIC }, { interval: fixed(200), runLength: 1000 });
    // Batch of 3 fills at 400 (arrivals 0, 200, 400): load 5, cure 100, unload 7.
    expect(
      of(events, 'partStarted')
        .slice(0, 3)
        .map((e) => e.t),
    ).toEqual([400, 400, 400]);
    expect(of(events, 'batchStarted')[0]).toMatchObject({ t: 405, endsAt: 505 });
    expect(of(events, 'batchFinished')[0]!.t).toBe(505);
    expect(
      of(events, 'partFinished')
        .slice(0, 3)
        .map((e) => e.t),
    ).toEqual([512, 512, 512]);
    // Tech works 5 + 7 s per batch, not per part: one batch (the next fills at 1000, the end) in 1000 s.
    expect(stats.techs['T-S1']!.working * 1000).toBeCloseTo(12, 6);
  });
});

describe('SF-6 AC5: determinism', () => {
  it('same seed and model give identical events and stats', () => {
    const go = (seed: number) =>
      run(
        { cure: { kind: 'normal', mean: 100, stdDev: 10 }, maxWait: 40 },
        { products: ['A', 'B'], interval: { kind: 'normal', mean: 20, stdDev: 8 }, seed },
      );
    const a = go(7);
    expect(go(7)).toEqual(a);
    expect(go(8).events).not.toEqual(a.events);
  });
});

describe('Run.batches(): cures in progress for re-seeding (SF-5, ADR-0017)', () => {
  function live(station: Partial<StationSpec>) {
    const spec: LineSpec = {
      products: ['A'],
      stations: [
        {
          id: 'S1',
          cycle: { A: fixed(1) },
          capacity: 3,
          batchSize: 3,
          cure: fixed(100),
          ...station,
        },
      ],
      interval: fixed(10),
    };
    const c = compileLine(lineProject(spec));
    if (!c.ok) throw new Error(JSON.stringify(c.issues));
    return createRun(c.model, { seed: 1, warmUp: 0, runLength: 3600 });
  }

  it('lists the batch between batchStarted and batchFinished, with events off', () => {
    // Automatic: batch fills at 20, load 5, cure 25 → 125, as in SF-6 AC3.
    const r = live({ labor: AUTOMATIC });
    r.setEventsEnabled(false);
    r.runUntil(24);
    expect(r.batches()).toEqual([]);
    r.runUntil(60);
    expect(r.batches()).toEqual([
      { equipmentId: 'S1', partIds: [1, 2, 3], startedAt: 25, endsAt: 125 },
    ]);
    r.runUntil(126);
    expect(r.batches()).toEqual([]);
  });

  it('is empty on stations without batches and returns copies', () => {
    const r = live({ batchSize: 1, capacity: 1, cure: undefined });
    r.runUntil(500);
    expect(r.batches()).toEqual([]);
    const b = live({});
    b.runUntil(60);
    const snap = b.batches();
    snap[0]!.partIds.push(99);
    expect(b.batches()[0]!.partIds).toEqual([1, 2, 3]);
  });
});
