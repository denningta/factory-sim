import { describe, expect, it } from 'vitest';
import { compileLine, createRun, type LineEvent } from './index';
import { fixed, lineProject, type StationSpec } from './line-fixture';

/** WS-3: a station's capacity and batch size are honored by the line model. */
function run(station: Partial<StationSpec>, interval = 1, techCount = station.capacity ?? 1) {
  const c = compileLine(
    lineProject({
      products: ['A'],
      // Techs default to one per unit of capacity; pass more so capacity is the only limit.
      stations: [{ id: 'S1', cycle: { A: fixed(10) }, ...station }],
      techs: Array.from({ length: techCount }, (_, i) => ({
        id: `T${i}`,
        name: `T${i}`,
        walkSpeed: 1,
        stationIds: ['S1'],
      })),
      interval: fixed(interval),
    }),
  );
  if (!c.ok) throw new Error(JSON.stringify(c.issues));
  const r = createRun(c.model, { seed: 1, warmUp: 0, runLength: 3600 });
  r.runUntil(r.endTime);
  return { stats: r.stats(), events: r.drainEvents() };
}

type Started = Extract<LineEvent, { type: 'partStarted' }>;
const started = (events: LineEvent[]) =>
  events.filter((e): e is Started => e.type === 'partStarted');

/** Max number of parts being processed at once, from each partStarted's [t, endsAt) interval. */
function peakInProcess(events: LineEvent[]) {
  const edges = started(events).flatMap((e) => [
    { t: e.t, d: 1 },
    { t: (expect(e.endsAt).toBeDefined(), e.endsAt!), d: -1 },
  ]);
  // Ends sort before starts at the same instant: a freed slot is reusable immediately.
  edges.sort((x, y) => x.t - y.t || x.d - y.d);
  let now = 0;
  let peak = 0;
  for (const { d } of edges) peak = Math.max(peak, (now += d));
  return peak;
}

describe('WS-3 capacity', () => {
  it('capacity = units processed at the same time: 3 fixtures triple the throughput', () => {
    const one = run({ capacity: 1 }).stats.total.completed;
    const three = run({ capacity: 3 }).stats.total.completed;
    expect(one).toBeGreaterThan(300);
    expect(three / one).toBeCloseTo(3, 1);
  });

  it('never processes more units at once than the capacity', () => {
    expect(peakInProcess(run({ capacity: 3 }).events)).toBe(3);
    expect(peakInProcess(run({ capacity: 1 }).events)).toBe(1);
  });
});

describe('WS-3 capacity is the only limit (surplus technicians)', () => {
  it('capacity 2 with 4 techs peaks at 2 and doubles capacity 1 throughput', () => {
    const one = run({ capacity: 1 }, 1, 4);
    const two = run({ capacity: 2 }, 1, 4);
    expect(peakInProcess(two.events)).toBe(2);
    expect(two.stats.total.completed / one.stats.total.completed).toBeCloseTo(2, 1);
  });
});

describe('WS-3 batch size', () => {
  it('processing starts only once batchSize units have accumulated', () => {
    // Parts arrive every 10 s; a batch of 3 starts when the third arrives.
    const { events } = run({ capacity: 3, batchSize: 3 }, 10);
    const starts = started(events).map((e) => e.t);
    expect(starts.slice(0, 6)).toEqual([...Array(3).fill(starts[0]), ...Array(3).fill(starts[3])]);
    expect(starts[3]! - starts[0]!).toBe(30);
  });

  it('a batch is processed together and finishes together', () => {
    const { events } = run({ capacity: 2, batchSize: 2 }, 10);
    const ends = started(events).map((e) => e.endsAt);
    expect(ends[0]).toBe(ends[1]);
    expect(ends[2]).toBe(ends[3]);
  });

  it('batch size 1 starts each unit as it arrives', () => {
    const { events } = run({ capacity: 1, batchSize: 1 }, 10);
    const starts = started(events).map((e) => e.t);
    expect(new Set(starts.slice(0, 5)).size).toBe(5);
  });
});

describe('WS-3 capacity and batch size together (test model)', () => {
  it('capacity 4 / batch 2 runs two batches at once, doubling a capacity 2 / batch 2 station', () => {
    const narrow = run({ capacity: 2, batchSize: 2 });
    const wide = run({ capacity: 4, batchSize: 2 }, 1, 8);
    expect(peakInProcess(wide.events)).toBe(4);
    expect(wide.stats.total.completed / narrow.stats.total.completed).toBeCloseTo(2, 1);
  });
});
