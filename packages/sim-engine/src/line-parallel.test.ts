/**
 * PS-1: parallel stations as routing-step alternates (ADR-0018). Each test builds a small
 * graph by hand: the straight-line fixture can't branch.
 */
import {
  BASE_EQUIPMENT_TYPES,
  createProject,
  instantiate,
  type Duration,
  type Equipment,
  type Labor,
  type Project,
} from '@factory-sim/schema';
import { describe, expect, it } from 'vitest';
import { compileLine, createRun, type LineEvent } from './index';
import { fixed } from './line-fixture';

interface WS {
  id: string;
  /** Cycle time (s) for every product routed here; omitted = no cycleTimes entry. */
  cycle?: number;
  capacity?: number;
  batchSize?: number;
  /** perBatch cure time (s). */
  cure?: number;
  maxWait?: number;
  labor?: Labor;
  /** Assign a technician (default: only for manual stations). */
  tech?: boolean;
}

interface Spec {
  stations: WS[];
  buffers?: { id: string; capacity: number }[];
  /** [from, to, capacity]: capacity undefined = unlimited, 0 = direct hand-off. */
  links: (readonly [string, string, number?])[];
  /** Routing per product id. */
  routing: Record<string, { stationId: string; alternates?: string[] }[]>;
  /** Per product, per station overrides of the station's cycle time. */
  cycles?: Record<string, Record<string, number | undefined>>;
  interval?: Duration;
}

const type = (behavior: string) => BASE_EQUIPMENT_TYPES.find((t) => t.behavior === behavior)!;

function build(spec: Spec): Project {
  const p = createProject();
  let n = 0;
  const at = (behavior: string, id: string) =>
    instantiate(type(behavior), {
      id,
      position: { x: (n % 4) * 4, y: Math.floor(n++ / 4) * 4 },
      rotation: 0,
    });
  const equipment: Equipment[] = [at('source', 'src')];
  for (const b of spec.buffers ?? []) {
    const e = at('buffer', b.id);
    if (e.behavior === 'buffer') e.params = { capacity: b.capacity };
    equipment.push(e);
  }
  for (const s of spec.stations) {
    const e = at('workstation', s.id);
    if (e.behavior === 'workstation')
      e.params = {
        capacity: s.capacity ?? 1,
        batchSize: s.batchSize ?? 1,
        labor: s.labor ?? { mode: 'manual' },
        ...(s.cure !== undefined && { cycle: { mode: 'perBatch' as const, time: fixed(s.cure) } }),
        ...(s.maxWait !== undefined && { maxWait: s.maxWait }),
      };
    equipment.push(e);
  }
  equipment.push(at('sink', 'sink'));
  p.equipment = equipment;
  p.connections = spec.links.map(([from, to, capacity]) => ({
    id: `${from}-${to}`,
    from: { equipmentId: from, portId: 'out' },
    to: { equipmentId: to, portId: 'in' },
    capacity: capacity ?? null,
    transfer: { kind: 'instant' as const },
  }));
  const products = Object.keys(spec.routing);
  p.products = products.map((id) => ({
    id,
    partNumber: `P-${id}`,
    name: id,
    color: '#336699',
    routing: spec.routing[id]!.map((s, i) => ({ id: `${id}-${i}`, ...s })),
  }));
  const byId = new Map(spec.stations.map((s) => [s.id, s]));
  p.cycleTimes = products.flatMap((pr) =>
    spec.routing[pr]!.flatMap((s) => [s.stationId, ...(s.alternates ?? [])]).flatMap((sid) => {
      const st = byId.get(sid)!;
      const cycles = spec.cycles?.[pr];
      const value = cycles && sid in cycles ? cycles[sid] : st.cycle;
      return st.cure !== undefined || value === undefined
        ? []
        : [{ productId: pr, stationId: sid, time: fixed(value) }];
    }),
  );
  p.release = { interval: spec.interval ?? fixed(10), product: { kind: 'smooth' } };
  p.technicians = spec.stations
    .filter((s) => s.tech ?? (s.labor ?? { mode: 'manual' }).mode === 'manual')
    .map((s) => ({ id: `T-${s.id}`, name: `Tech ${s.id}`, walkSpeed: 1.2, stationIds: [s.id] }));
  return p;
}

function run(spec: Spec, opts: { runLength: number; warmUp?: number; seed?: number }) {
  const c = compileLine(build(spec));
  if (!c.ok) throw new Error(JSON.stringify(c.issues));
  const r = createRun(c.model, {
    seed: opts.seed ?? 1,
    warmUp: opts.warmUp ?? 0,
    runLength: opts.runLength,
  });
  r.runUntil(r.endTime);
  return { run: r, stats: r.stats(), events: r.drainEvents() };
}

const of = <T extends LineEvent['type']>(events: LineEvent[], type: T) =>
  events.filter((e): e is Extract<LineEvent, { type: T }> => e.type === type);

/** Part ids in release order. */
const released = (events: LineEvent[]) => of(events, 'partReleased').map((e) => e.partId);

/** The workstation each part (in release order) started at, among `group`. */
function stationsUsed(events: LineEvent[], group: string[]) {
  const started = of(events, 'partStarted').filter((e) => group.includes(e.equipmentId));
  return released(events).map((id) => started.find((e) => e.partId === id)?.equipmentId);
}

/** The connection a move went along (undefined for conveyor travel). */
const conn = (e: Extract<LineEvent, { type: 'partMoved' }> | undefined) =>
  e && 'connectionId' in e.via ? e.via.connectionId : undefined;

/** The time a part moved along a connection. */
const movedAt = (events: LineEvent[], partId: number, connectionId: string) =>
  of(events, 'partMoved').find((e) => e.partId === partId && conn(e) === connectionId)?.t;

const issues = (p: Project) => {
  const c = compileLine(p);
  return c.ok ? [] : c.issues;
};

/** src → B → {P1, P2} → sink, links from B with the given capacity. */
const twoFromBuffer = (
  p1: Partial<WS>,
  p2: Partial<WS>,
  link?: number,
  routing: { stationId: string; alternates?: string[] } = { stationId: 'P1', alternates: ['P2'] },
): Spec => ({
  stations: [
    { id: 'P1', cycle: 100, ...p1 },
    { id: 'P2', cycle: 100, ...p2 },
  ],
  buffers: [{ id: 'B', capacity: 50 }],
  links: [
    ['src', 'B'],
    ['B', 'P1', link],
    ['B', 'P2', link],
    ['P1', 'sink'],
    ['P2', 'sink'],
  ],
  routing: { A: [routing] },
});

describe('PS-1 AC1: dispatch to a candidate with room (ADR-0018 §2)', () => {
  it('both have room: fewest parts waiting, then listed order', () => {
    const { events } = run(twoFromBuffer({}, {}), { runLength: 45 });
    expect(stationsUsed(events, ['P1', 'P2'])).toEqual(['P1', 'P2', 'P1', 'P2', 'P1']);
  });

  it('a tie goes to listed order: stationId first', () => {
    const spec = twoFromBuffer({}, {}, undefined, { stationId: 'P2', alternates: ['P1'] });
    const { events } = run(spec, { runLength: 25 });
    expect(stationsUsed(events, ['P1', 'P2'])).toEqual(['P2', 'P1', 'P2']);
  });

  it('neither has room: the part waits in the buffer and takes whichever frees first', () => {
    // P1 cures 100 s, P2 50 s; direct hand-offs, so a busy station has no room.
    const { events } = run(twoFromBuffer({ cycle: 100 }, { cycle: 50 }, 0), { runLength: 105 });
    const [p1, p2, p3, p4] = released(events);
    expect(movedAt(events, p1!, 'B-P1')).toBe(0);
    expect(movedAt(events, p2!, 'B-P2')).toBe(10);
    expect(movedAt(events, p3!, 'B-P2')).toBe(60); // P2 frees first
    expect(movedAt(events, p3!, 'B-P1')).toBeUndefined();
    expect(movedAt(events, p4!, 'B-P1')).toBe(100); // FIFO: p4 behind p3
  });

  it('neither has room on a direct hand-off: the previous station blocks until one frees', () => {
    const spec: Spec = {
      stations: [
        { id: 'U', cycle: 1 },
        { id: 'P1', cycle: 100 },
        { id: 'P2', cycle: 100 },
      ],
      links: [
        ['src', 'U'],
        ['U', 'P1', 0],
        ['U', 'P2', 0],
        ['P1', 'sink'],
        ['P2', 'sink'],
      ],
      routing: { A: [{ stationId: 'U' }, { stationId: 'P1', alternates: ['P2'] }] },
    };
    const c = compileLine(build(spec));
    if (!c.ok) throw new Error(JSON.stringify(c.issues));
    const r = createRun(c.model, { seed: 1, warmUp: 0, runLength: 105 });
    r.runUntil(50);
    expect(r.stationStates().U).toBe('blocked'); // p3 finished at 21, both busy
    r.runUntil(r.endTime);
    const events = r.drainEvents();
    const [, , p3] = released(events);
    expect(movedAt(events, p3!, 'U-P1')).toBe(101);
  });

  it('paths diverge before the buffer: chosen when leaving the previous station, by each branch’s first place', () => {
    const spec: Spec = {
      stations: [
        { id: 'U', cycle: 1 },
        { id: 'P1', cycle: 100 },
        { id: 'P2', cycle: 100 },
      ],
      buffers: [
        { id: 'B1', capacity: 1 },
        { id: 'B2', capacity: 1 },
      ],
      links: [
        ['src', 'U'],
        ['U', 'B1', 0],
        ['U', 'B2', 0],
        ['B1', 'P1', 0],
        ['B2', 'P2', 0],
        ['P1', 'sink'],
        ['P2', 'sink'],
      ],
      routing: { A: [{ stationId: 'U' }, { stationId: 'P1', alternates: ['P2'] }] },
    };
    const { events } = run(spec, { runLength: 105 });
    const ids = released(events);
    const branch = (id: number) =>
      of(events, 'partMoved').find(
        (e) => e.partId === id && (conn(e) === 'U-B1' || conn(e) === 'U-B2'),
      );
    expect(ids.slice(0, 4).map((id) => conn(branch(id)))).toEqual([
      'U-B1',
      'U-B2',
      'U-B1', // tie 1:1 → listed order; waits in B1
      'U-B2', // B1 full
    ]);
    // Neither branch has room: U blocks; P1 frees at 101, p3 moves on and B1 frees.
    expect(branch(ids[4]!)).toMatchObject({ t: 101, via: { connectionId: 'U-B1' } });
  });
});

describe('PS-1 AC2: parallel perBatch stations consolidate (ADR-0018 §3)', () => {
  const autoclave = { capacity: 3, batchSize: 3, cure: 100 };

  it('a part prefers a station already loading; the second loads only when the first is curing', () => {
    const { events } = run(twoFromBuffer(autoclave, autoclave), { runLength: 200 });
    const ids = released(events);
    expect(
      of(events, 'batchStarted')
        .slice(0, 3)
        .map((e) => [e.equipmentId, e.t, e.partIds]),
    ).toEqual([
      ['P1', 20, ids.slice(0, 3)],
      ['P2', 50, ids.slice(3, 6)],
      ['P1', 120, ids.slice(6, 9)],
    ]);
  });

  it('maxWait runs separately on each station', () => {
    const spec = twoFromBuffer({ ...autoclave, maxWait: 30 }, { ...autoclave, maxWait: 30 });
    spec.interval = fixed(25);
    const { events } = run(spec, { runLength: 100 });
    const ids = released(events);
    expect(of(events, 'batchStarted').map((e) => [e.equipmentId, e.t, e.partIds])).toEqual([
      ['P1', 30, ids.slice(0, 2)],
      ['P2', 80, ids.slice(2, 4)],
    ]);
  });

  it('edge case: at most one station is partially loaded at a time', () => {
    const spec = twoFromBuffer(autoclave, autoclave);
    spec.interval = { kind: 'exponential', mean: 30 };
    const c = compileLine(build(spec));
    if (!c.ok) throw new Error(JSON.stringify(c.issues));
    const r = createRun(c.model, { seed: 7, warmUp: 0, runLength: 4 * 3600 });
    r.setEventsEnabled(false);
    for (let t = 7; t < r.endTime; t += 7) {
      r.runUntil(t);
      const loading = new Set(
        r
          .wip()
          .flatMap((p) => (p.last.type === 'partEntered' ? [p.last.equipmentId] : []))
          .filter((id) => id === 'P1' || id === 'P2'),
      );
      expect(loading.size, `t=${t}`).toBeLessThanOrEqual(1);
    }
    const stations = r.stats().stations;
    expect(stations.P1!.working).toBeGreaterThan(0.2);
    expect(stations.P2!.working).toBeGreaterThan(0.2);
  });
});

describe('PS-1 AC3: compile checks every station pair', () => {
  const pairSpec = (links: Spec['links']): Spec => ({
    stations: [
      { id: 'U', cycle: 1 },
      { id: 'P1', cycle: 10 },
      { id: 'P2', cycle: 10 },
    ],
    links,
    routing: { A: [{ stationId: 'U' }, { stationId: 'P1', alternates: ['P2'] }] },
  });

  it('a missing (previous-step station, this-step station) pair is no_path naming both', () => {
    const p = build(
      pairSpec([
        ['src', 'U'],
        ['U', 'P1'],
        ['P1', 'sink'],
        ['P2', 'sink'],
      ]),
    );
    const found = issues(p);
    expect(found).toEqual([expect.objectContaining({ code: 'no_path', objectId: 'A-1' })]);
    expect(found[0]!.message).toMatch(/"U"/);
    expect(found[0]!.message).toMatch(/"P2"/);
  });

  it('every previous-step alternate is checked against this step', () => {
    const spec: Spec = {
      stations: [
        { id: 'P1', cycle: 10 },
        { id: 'P2', cycle: 10 },
        { id: 'D', cycle: 10 },
      ],
      links: [
        ['src', 'P1'],
        ['src', 'P2'],
        ['P1', 'D'],
        ['D', 'sink'],
      ],
      routing: { A: [{ stationId: 'P1', alternates: ['P2'] }, { stationId: 'D' }] },
    };
    const found = issues(build(spec));
    expect(found).toEqual([expect.objectContaining({ code: 'no_path', objectId: 'A-1' })]);
    expect(found[0]!.message).toMatch(/"P2"/);
    expect(found[0]!.message).toMatch(/"D"/);
  });

  it('every last-step station needs a path to a sink', () => {
    const p = build(
      pairSpec([
        ['src', 'U'],
        ['U', 'P1'],
        ['U', 'P2'],
        ['P1', 'sink'],
      ]),
    );
    const found = issues(p);
    expect(found).toEqual([expect.objectContaining({ code: 'no_path', objectId: 'A-1' })]);
    expect(found[0]!.message).toMatch(/"P2"/);
    expect(found[0]!.message).toMatch(/sink/);
  });

  const connected: Spec['links'] = [
    ['src', 'U'],
    ['U', 'P1'],
    ['U', 'P2'],
    ['P1', 'sink'],
    ['P2', 'sink'],
  ];

  it('every alternate needs a cycle time', () => {
    const spec = pairSpec(connected);
    spec.cycles = { A: { P2: undefined } };
    const found = issues(build(spec));
    expect(found).toEqual([
      expect.objectContaining({ code: 'missing_cycle_time', objectId: 'A-1' }),
    ]);
    expect(found[0]!.message).toMatch(/"P2"/);
  });

  it('a perBatch alternate needs no cycle time', () => {
    const spec = pairSpec(connected);
    spec.stations[2] = { id: 'P2', cure: 50, capacity: 2, batchSize: 2 };
    expect(issues(build(spec))).toEqual([]);
  });

  it('edge case: manual alternates each need their own technician', () => {
    const spec = pairSpec(connected);
    spec.stations[2] = { id: 'P2', cycle: 10, tech: false };
    expect(issues(build(spec))).toEqual([
      expect.objectContaining({ code: 'manual_station_without_tech', objectId: 'P2' }),
    ]);
  });
});

describe('PS-1 AC4: ADR-0018 edge cases (engine)', () => {
  it('different cycle times at alternates: each station uses its own', () => {
    const { events } = run(twoFromBuffer({ cycle: 30 }, { cycle: 70 }), { runLength: 200 });
    const spans = of(events, 'partStarted').map((e) => [e.equipmentId, e.endsAt! - e.t]);
    expect(new Set(spans.map(String))).toEqual(new Set(['P1,30', 'P2,70']));
  });

  it('alternates of different types (automatic + manual bench) both take parts', () => {
    const auto: Labor = { mode: 'automatic', loadTime: fixed(1), unloadTime: fixed(1) };
    const { events } = run(twoFromBuffer({ labor: auto }, {}), { runLength: 300 });
    const used = new Set(stationsUsed(events, ['P1', 'P2']));
    expect(used).toEqual(new Set(['P1', 'P2']));
  });

  it('a station can be an alternate in one routing and the primary in another', () => {
    const spec = twoFromBuffer({}, {});
    spec.routing = {
      A: [{ stationId: 'P1', alternates: ['P2'] }],
      B: [{ stationId: 'P2' }],
    };
    const { events } = run(spec, { runLength: 600 });
    const productOf = new Map(of(events, 'partReleased').map((e) => [e.partId, e.productId]));
    const at = (product: string) =>
      new Set(
        of(events, 'partStarted')
          .filter((e) => productOf.get(e.partId) === product)
          .map((e) => e.equipmentId),
      );
    expect(at('A')).toEqual(new Set(['P1', 'P2']));
    expect(at('B')).toEqual(new Set(['P2']));
  });
});

describe('PS-1 AC5: two autoclaves give about 2× the throughput of one', () => {
  it('doubles the bottleneck step’s throughput', () => {
    const autoclave = { capacity: 3, batchSize: 3, cure: 120 };
    const one = twoFromBuffer(autoclave, autoclave, undefined, { stationId: 'P1' });
    const two = twoFromBuffer(autoclave, autoclave);
    const opts = { warmUp: 3600, runLength: 8 * 3600 };
    const a = run(one, opts).stats;
    const b = run(two, opts).stats;
    expect(a.total.throughputPerHour).toBeGreaterThan(80); // 3 parts / 120 s = 90/h
    expect(b.total.throughputPerHour / a.total.throughputPerHour).toBeGreaterThan(1.9);
    expect(b.total.throughputPerHour / a.total.throughputPerHour).toBeLessThan(2.1);
    // Utilization stays per station.
    expect(b.stations.P1!.working).toBeGreaterThan(0.9);
    expect(b.stations.P2!.working).toBeGreaterThan(0.9);
  });
});

describe('PS-1 AC6: determinism with alternates', () => {
  it('same seed ⇒ identical event log', () => {
    const spec = twoFromBuffer({ cycle: 40 }, { cycle: 60 });
    spec.interval = { kind: 'exponential', mean: 25 };
    const a = run(spec, { runLength: 3600, seed: 42 }).events;
    const b = run(spec, { runLength: 3600, seed: 42 }).events;
    expect(new Set(stationsUsed(a, ['P1', 'P2']))).toEqual(new Set(['P1', 'P2']));
    expect(b).toEqual(a);
  });
});
