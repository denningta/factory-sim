import { describe, expect, it } from 'vitest';
import { compileLine, createRun, type LineEvent, type RunOptions } from './index';
import { fixed, lineProject, type LineSpec } from './line-fixture';

/** Line mechanics behind SE-6 (WS-3, FL-3, PR-4 and FL-4 build their acceptance tests on these). */
function runLine(spec: LineSpec, opts: Partial<RunOptions> = {}) {
  const c = compileLine(lineProject(spec));
  if (!c.ok) throw new Error(JSON.stringify(c.issues));
  const r = createRun(c.model, { seed: 1, warmUp: 600, runLength: 3600, ...opts });
  r.runUntil(r.endTime);
  return { stats: r.stats(), events: r.drainEvents() };
}

const two = (c1: number, c2: number, extra: Partial<LineSpec> = {}): LineSpec => ({
  products: ['A'],
  stations: [
    { id: 'S1', cycle: { A: fixed(c1) } },
    { id: 'S2', cycle: { A: fixed(c2) } },
  ],
  interval: fixed(1), // flood: S1 never starves
  ...extra,
});

describe('blocking and buffers', () => {
  it('capacity 0 is a direct hand-off: S1 blocks while S2 is busy', () => {
    const { stats } = runLine(two(10, 20, { linkCapacity: 0 }));
    expect(stats.stations['S1']!.working).toBeCloseTo(0.5, 2);
    expect(stats.stations['S1']!.blocked).toBeCloseTo(0.5, 2);
    expect(stats.stations['S2']!.working).toBeCloseTo(1, 9);
    expect(stats.total.throughputPerHour).toBeCloseTo(180, 0);
    expect(stats.total.averageWip).toBeLessThanOrEqual(3);
  });

  it('a finite buffer fills, then S1 blocks', () => {
    const { stats } = runLine(two(10, 20, { linkCapacity: 0, inserts: { 0: { buffer: 5 } } }));
    expect(stats.stations['S1']!.blocked).toBeCloseTo(0.5, 2);
    expect(stats.total.averageWip).toBeCloseTo(7, 0); // S1 + 5 in the buffer + S2; nothing waits at the source
  });

  it('an unlimited connection never blocks', () => {
    const { stats } = runLine(two(10, 20, { linkCapacity: null }));
    expect(stats.stations['S1']!.blocked).toBe(0);
    expect(stats.stations['S1']!.working).toBeCloseTo(1, 9);
  });
});

describe('transfers and conveyors', () => {
  const single = (extra: Partial<LineSpec>): LineSpec => ({
    products: ['A'],
    stations: [{ id: 'S1', cycle: { A: fixed(30) } }],
    ...extra,
  });

  it('adds fixed and speed-based transfer times to the lead time', () => {
    // Source out port at x = 0.5, S1 in port at x = 4 − 0.75: 2.75 m at 0.5 m/s.
    const { stats, events } = runLine(
      single({
        links: {
          0: { transfer: { kind: 'speed', speed: 0.5 } },
          1: { transfer: { kind: 'fixed', time: fixed(5) } },
        },
      }),
    );
    expect(stats.total.averageLeadTime).toBeCloseTo(40.5, 9);
    const move = events.find(
      (e) => e.type === 'partMoved' && 'connectionId' in e.via && e.via.connectionId === 'L1',
    );
    expect(move).toMatchObject({ arrivesAt: move!.t + 5 });
  });

  it('carries parts across a conveyor at belt speed (footprint length 3 m)', () => {
    const { stats, events } = runLine(single({ inserts: { 0: { conveyorSpeed: 0.5 } } }));
    expect(stats.total.averageLeadTime).toBeCloseTo(36, 9);
    expect(
      events.some(
        (e) => e.type === 'partMoved' && 'equipmentId' in e.via && e.via.equipmentId === 'C1',
      ),
    ).toBe(true);
  });

  it('passes through a buffer without delay', () => {
    const { stats, events } = runLine(single({ inserts: { 0: { buffer: 3 } } }));
    expect(stats.total.averageLeadTime).toBeCloseTo(30, 9);
    expect(events.some((e) => e.type === 'partEntered' && e.equipmentId === 'B1')).toBe(true);
  });
});

describe('labor and technicians', () => {
  it('automatic stations need the tech only to load and unload', () => {
    const { stats, events } = runLine({
      products: ['A'],
      stations: [
        {
          id: 'S1',
          cycle: { A: fixed(10) },
          labor: { mode: 'automatic', loadTime: fixed(2), unloadTime: fixed(3) },
        },
      ],
    });
    expect(stats.total.averageLeadTime).toBeCloseTo(15, 9);
    expect(stats.stations['S1']!.working).toBeCloseTo(15 / 60, 9);
    expect(stats.techs['T-S1']!.working).toBeCloseTo(5 / 60, 9);
    expect(events.find((e) => e.type === 'partStarted')).not.toHaveProperty('endsAt');
  });

  it('automatic stations without a tech load and unload on their own', () => {
    const { stats } = runLine({
      products: ['A'],
      stations: [
        {
          id: 'S1',
          cycle: { A: fixed(10) },
          labor: { mode: 'automatic', loadTime: fixed(2), unloadTime: fixed(3) },
        },
      ],
      techs: false,
    });
    expect(stats.total.averageLeadTime).toBeCloseTo(15, 9);
  });

  it('one tech walks between the stations it runs; stations wait for it (idle)', () => {
    const { stats, events } = runLine({
      products: ['A'],
      stations: [
        { id: 'S1', cycle: { A: fixed(10) } },
        { id: 'S2', cycle: { A: fixed(10) } },
      ],
      techs: [{ id: 'T', name: 'T', walkSpeed: 1, stationIds: ['S1', 'S2'] }],
    });
    // Per 60 s: walk 4 s to S1, work 10, walk 4 to S2, work 10.
    expect(stats.total.averageLeadTime).toBeCloseTo(28, 9);
    expect(stats.stations['S1']!.idle).toBeCloseTo(4 / 60, 2);
    expect(stats.techs['T']!.walking).toBeCloseTo(8 / 60, 2);
    expect(stats.techs['T']!.working).toBeCloseTo(20 / 60, 2);
    const walk = events.find((e) => e.type === 'techMoved');
    expect(walk).toMatchObject({ techId: 'T', arrivesAt: walk!.t + 4 });
  });

  it('a station served by two techs takes whichever is free', () => {
    const { stats } = runLine({
      products: ['A'],
      stations: [{ id: 'S1', cycle: { A: fixed(50) }, capacity: 2 }],
      interval: fixed(20),
      techs: [
        { id: 'T1', name: 'T1', walkSpeed: 1, stationIds: ['S1'] },
        { id: 'T2', name: 'T2', walkSpeed: 1, stationIds: ['S1'] },
      ],
    });
    expect(stats.stations['S1']!.working).toBeCloseTo(1, 9);
    expect(stats.techs['T1']!.working + stats.techs['T2']!.working).toBeCloseTo(2, 1);
  });
});

describe('batches', () => {
  it('waits for a full batch and processes it together', () => {
    const { stats } = runLine({
      products: ['A'],
      stations: [{ id: 'S1', cycle: { A: fixed(15) }, capacity: 4, batchSize: 2 }],
      interval: fixed(10),
    });
    expect(stats.total.averageLeadTime).toBeCloseTo(20, 9); // 25 and 15
    expect(stats.stations['S1']!.working).toBeCloseTo(0.75, 2);
    expect(stats.stations['S1']!.starved).toBeCloseTo(0.25, 2);
  });
});

describe('release rules', () => {
  const mixed = (extra: Partial<LineSpec>): LineSpec => ({
    products: ['A', 'B'],
    stations: [{ id: 'S1', cycle: { A: fixed(10), B: fixed(10) } }],
    ...extra,
  });
  const released = (spec: LineSpec, opts: Partial<RunOptions> = {}) => {
    const { stats } = runLine(spec, { warmUp: 0, ...opts });
    return [stats.byProduct['A']!.released, stats.byProduct['B']!.released];
  };

  it('sequence repeats the heijunka pattern', () => {
    expect(released(mixed({ release: { kind: 'sequence', pattern: ['A', 'A', 'B'] } }))).toEqual([
      41, 20,
    ]);
  });

  it('smooth follows the demand mix deterministically', () => {
    const demand = {
      basis: 'mix' as const,
      items: [
        { productId: 'A', value: 75 },
        { productId: 'B', value: 25 },
      ],
    };
    expect(released(mixed({ demand }))).toEqual([46, 15]);
    const perShift = {
      basis: 'perShift' as const,
      items: [
        { productId: 'A', value: 30 },
        { productId: 'B', value: 10 },
      ],
    };
    expect(released(mixed({ demand: perShift }))).toEqual([46, 15]);
    expect(released(mixed({}))).toEqual([31, 30]); // no demand: equal shares
  });

  it('random draws products by mix', () => {
    const demand = {
      basis: 'mix' as const,
      items: [
        { productId: 'A', value: 60 },
        { productId: 'B', value: 40 },
      ],
    };
    const [a, b] = released(mixed({ demand, release: { kind: 'random' }, interval: fixed(12) }), {
      runLength: 100 * 3600,
    });
    expect(a! / (a! + b!)).toBeCloseTo(0.6, 1);
  });
});

describe('events', () => {
  it('reports initial states, then each part from release to exit in time order', () => {
    const { events } = runLine(
      { products: ['A'], stations: [{ id: 'S1', cycle: { A: fixed(30) } }] },
      { warmUp: 0, runLength: 59 },
    );
    expect(events.slice(0, 2)).toEqual<LineEvent[]>([
      { t: 0, type: 'stationState', stationId: 'S1', state: 'starved' },
      { t: 0, type: 'techState', techId: 'T-S1', state: 'idle' },
    ]);
    const part = events.filter((e) => 'partId' in e).map((e) => [e.t, e.type]);
    expect(part).toEqual([
      [0, 'partReleased'],
      [0, 'partMoved'],
      [0, 'partEntered'],
      [0, 'partStarted'],
      [30, 'partMoved'],
      [30, 'partExited'],
    ]);
    expect(events.map((e) => e.t)).toEqual([...events.map((e) => e.t)].sort((x, y) => x - y));
  });

  it('rejects invalid run options', () => {
    const c = compileLine(
      lineProject({ products: ['A'], stations: [{ id: 'S1', cycle: { A: fixed(30) } }] }),
    );
    if (!c.ok) throw new Error('compile');
    expect(() => createRun(c.model, { seed: 1, warmUp: -1, runLength: 10 })).toThrow();
    expect(() => createRun(c.model, { seed: 1, warmUp: 0, runLength: Infinity })).toThrow();
  });
});
