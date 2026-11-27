import { describe, expect, it } from 'vitest';
import { projectSchema } from '@factory-sim/schema';
import { compileLine, createRun, type LineEvent } from '@factory-sim/sim-engine';
import { buildLineGeometry, createPartTracks, type LineGeometry } from './partTracks';
import { createPlayback } from './playback';
import { createRunSession } from './runSession';
import { MODELS } from '../equipment/models/registry';
import modelJson from '../../../../docs/reference-model/model.json';

const P = (x: number, y: number, z: number) => ({ x, y, z });
const slotsAt = (x: number) => (i: number) => P(x, 0.3 + 0.1 * i, 5);
type Eq = LineGeometry['equipment'] extends ReadonlyMap<string, infer V> ? V : never;
const bench = (cx: number): Eq => ({
  center: { x: cx, z: 0 },
  operator: { x: cx, z: 1 },
  queueSlot: slotsAt(cx),
  path: [
    { x: cx, z: 0 },
    { x: cx, z: 0 },
  ] as [{ x: number; z: number }, { x: number; z: number }],
  workSurface: P(cx, 0.9, 0),
  inTray: [P(cx - 2, 0.9, -0.5), P(cx - 2, 0.9, 0.5)],
  outTray: [P(cx + 2, 0.9, -0.5), P(cx + 2, 0.9, 0.5)],
});
const geometry: LineGeometry = {
  connections: new Map([
    ['c1', { from: { x: 12, z: 0 }, to: { x: 18, z: 0 }, fromId: 'ws', toId: 'ws2' }],
  ]),
  equipment: new Map<string, Eq>([
    ['ws', bench(10)],
    ['ws2', bench(20)],
    [
      'belt',
      {
        center: { x: 30, z: 0 },
        operator: { x: 30, z: 0 },
        queueSlot: slotsAt(30),
        path: [
          { x: 28, z: 0 },
          { x: 32, z: 0 },
        ] as [{ x: number; z: number }, { x: number; z: number }],
      },
    ],
    [
      'ac',
      {
        ...bench(40),
        inTray: [P(38, 0.8, 0), P(38.4, 0.8, 0)],
        outTray: [P(42, 0.8, 0), P(42.4, 0.8, 0)],
        cure: { travel: { x: 0, z: -2 } },
      },
    ],
  ]),
};
const colors = new Map([['p1', '#3b82f6']]);

const rel = (t: number, partId: number): LineEvent => ({
  t,
  type: 'partReleased',
  partId,
  productId: 'p1',
  sourceId: 'ws',
});
const enter = (t: number, partId: number, equipmentId: string): LineEvent => ({
  t,
  type: 'partEntered',
  partId,
  equipmentId,
});
const start = (t: number, partId: number, equipmentId: string, endsAt?: number): LineEvent => ({
  t,
  type: 'partStarted',
  partId,
  equipmentId,
  ...(endsAt !== undefined && { endsAt }),
});
const finished = (t: number, partId: number, equipmentId: string): LineEvent => ({
  t,
  type: 'partFinished',
  partId,
  equipmentId,
});

describe('SF-5 AC1: parts sit on the work surface and in the trays', () => {
  it('a part in process sits on the station workSurface', () => {
    const tr = createPartTracks(geometry, colors);
    tr.ingest([rel(0, 1), enter(1, 1, 'ws'), start(2, 1, 'ws', 8)]);
    expect(tr.at(3).find((p) => p.partId === 1)).toMatchObject({
      state: 'processing',
      x: 10,
      y: 0.9,
      z: 0,
    });
  });

  it('queued parts fill the inTray slots in arrival order, then go on in the queue grid', () => {
    const tr = createPartTracks(geometry, colors);
    tr.ingest([1, 2, 3].flatMap((id) => [rel(0, id), enter(id, id, 'ws')]));
    const poses = tr.at(5);
    expect(poses.find((p) => p.partId === 1)).toMatchObject({ x: 8, y: 0.9, z: -0.5 });
    expect(poses.find((p) => p.partId === 2)).toMatchObject({ x: 8, y: 0.9, z: 0.5 });
    // Past the tray it is the model's own queueSlot(2), not a column on the last tray slot.
    expect(poses.find((p) => p.partId === 3)).toMatchObject({ x: 10, y: 0.5, z: 5 });
  });

  it('finished parts waiting for downstream sit in the outTray slots', () => {
    const tr = createPartTracks(geometry, colors);
    tr.ingest([
      rel(0, 1),
      rel(0, 2),
      start(1, 1, 'ws', 4),
      start(1, 2, 'ws', 5),
      finished(4, 1, 'ws'),
      finished(5, 2, 'ws'),
    ]);
    const poses = tr.at(6);
    expect(poses.find((p) => p.partId === 1)).toMatchObject({
      state: 'finished',
      x: 12,
      y: 0.9,
      z: -0.5,
    });
    expect(poses.find((p) => p.partId === 2)).toMatchObject({ state: 'finished', x: 12, z: 0.5 });
  });
});

describe('SF-5 AC2: a move runs from the out-tray to the in-tray, eased', () => {
  const moved = (via: { connectionId: string } | { equipmentId: string }): LineEvent => ({
    t: 10,
    type: 'partMoved',
    partId: 1,
    via,
    arrivesAt: 20,
  });
  const base = [rel(0, 1), start(1, 1, 'ws', 4), finished(4, 1, 'ws')];

  it('starts at the upstream out-tray and ends at the downstream in-tray', () => {
    const tr = createPartTracks(geometry, colors);
    tr.ingest([...base, moved({ connectionId: 'c1' })]);
    expect(tr.at(10).find((p) => p.partId === 1)).toMatchObject({
      state: 'moving',
      x: 12,
      z: -0.5,
    });
    const end = tr.at(19.999).find((p) => p.partId === 1)!;
    expect(end.x).toBeCloseTo(18, 2);
    expect(end.z).toBeCloseTo(-0.5, 2);
    expect(end.y).toBeCloseTo(0.9, 2);
  });

  it('eases: a quarter of the way in time is less than a quarter of the way in space', () => {
    const tr = createPartTracks(geometry, colors);
    tr.ingest([...base, moved({ connectionId: 'c1' })]);
    const p = tr.at(12.5).find((q) => q.partId === 1)!;
    expect((p.x - 12) / 6).toBeGreaterThan(0);
    expect((p.x - 12) / 6).toBeLessThan(0.2);
    const mid = tr.at(15).find((q) => q.partId === 1)!;
    expect(mid.x).toBeCloseTo(15, 6);
  });

  it('conveyors keep their belt path: linear along the path', () => {
    const tr = createPartTracks(geometry, colors);
    tr.ingest([rel(0, 1), moved({ equipmentId: 'belt' })]);
    const p = tr.at(12.5).find((q) => q.partId === 1)!;
    expect(p.x).toBeCloseTo(29, 6);
  });
});

describe('SF-5 AC3: every part in the line is drawn exactly once (reference model)', () => {
  const reference = () => {
    const project = projectSchema.parse(modelJson);
    const c = compileLine(project);
    if (!c.ok) throw new Error('compile');
    const g = buildLineGeometry(project.equipment, project.connections);
    const col = new Map(project.products.map((p) => [p.id, p.color]));
    return createPlayback(createRun(c.model, { seed: 1, warmUp: 0, runLength: 4 * 3600 }), g, col, {
      sliceMs: 0,
    });
  };

  it('drawn parts equal run.wip().length at sampled times, animated', () => {
    const pb = reference();
    let sampled = 0;
    for (let i = 0; i < 200; i++) {
      pb.advance(7);
      const drawn = pb.tracks.at(pb.run.now);
      expect(drawn.length).toBe(pb.run.wip().length);
      expect(new Set(drawn.map((p) => p.partId)).size).toBe(drawn.length);
      sampled += drawn.length;
    }
    expect(sampled).toBeGreaterThan(100);
  });

  it('and after turning animation off and back on', () => {
    const pb = reference();
    for (let i = 0; i < 60; i++) pb.advance(7);
    pb.animate = false;
    pb.advance(1);
    pb.animate = true;
    expect(pb.tracks.at(pb.run.now).length).toBe(pb.run.wip().length);
    for (let i = 0; i < 60; i++) {
      pb.advance(5);
      expect(pb.tracks.at(pb.run.now).length).toBe(pb.run.wip().length);
    }
  });
});

describe('SF-5 AC4: autoclave door, cart and cure progress', () => {
  const batch: LineEvent[] = [
    rel(0, 1),
    rel(0, 2),
    enter(1, 1, 'ac'),
    enter(2, 2, 'ac'),
    { t: 10, type: 'batchStarted', equipmentId: 'ac', partIds: [1, 2], endsAt: 70 },
    start(10, 1, 'ac', 70),
    start(10, 2, 'ac', 70),
  ];
  const tracks = () => {
    const tr = createPartTracks(geometry, colors);
    tr.ingest(batch);
    return tr;
  };

  it('the door is open during load, closed during the cure, open again to unload', () => {
    const tr = tracks();
    expect(tr.cure('ac', 5).door).toBe(1);
    expect(tr.cure('ac', 40).door).toBe(0);
    expect(tr.cure('ac', 75).door).toBe(1);
    const closing = tr.cure('ac', 11.5).door;
    expect(closing).toBeGreaterThan(0);
    expect(closing).toBeLessThan(1);
  });

  it('the cart is out while loading and rides into the vessel for the cure', () => {
    const tr = tracks();
    expect(tr.cure('ac', 5).cart).toBe(0);
    expect(tr.cure('ac', 40).cart).toBe(1);
    expect(tr.cure('ac', 80).cart).toBe(0);
  });

  it('batch parts ride the cart: they move with it into the vessel', () => {
    const tr = tracks();
    const out = tr.at(5).find((p) => p.partId === 1)!;
    expect(out).toMatchObject({ state: 'queued', x: 38, z: 0 });
    const inside = tr.at(40).find((p) => p.partId === 1)!;
    expect(inside).toMatchObject({ state: 'processing', x: 38, y: 0.8, z: -2 });
  });

  it('shows cure progress from batchStarted.endsAt, and none outside the cure', () => {
    const tr = tracks();
    expect(tr.cure('ac', 5).progress).toBeNull();
    expect(tr.cure('ac', 40).progress).toBeCloseTo(0.5, 6);
    expect(tr.cure('ac', 70).progress).toBeNull();
  });

  it('is re-seeded from a partStarted with endsAt when animation comes back on mid-cure', () => {
    const tr = createPartTracks(geometry, colors);
    tr.seed([
      {
        partId: 1,
        productId: 'p1',
        releasedAt: 0,
        last: start(10, 1, 'ac', 70) as Extract<LineEvent, { type: 'partStarted' }>,
      },
    ]);
    expect(tr.cure('ac', 40).progress).toBeCloseTo(0.5, 6);
  });

  it('the autoclave model takes parts in at the door/cart, not the rear, and has a cure rig', () => {
    const m = MODELS.find((x) => x.id === 'asc-autoclave')!;
    const { anchors } = m.build({ width: 2.4, length: 5, height: 2.6 }, {});
    expect(anchors.input[2]).toBeGreaterThan(0);
    expect(anchors.cure).toBeDefined();
    expect(anchors.inTray?.length).toBeGreaterThan(0);
    expect(anchors.outTray?.length).toBeGreaterThan(0);
  });
});

describe('SF-5: machine parts in process are visible', () => {
  it('the machine workSurface and trays are outside the cabinet, on a front shelf', () => {
    const m = MODELS.find((x) => x.id === 'machine')!;
    const size = { width: 1.6, length: 2, height: 1.8 };
    const { anchors, lods } = m.build(size, {});
    const body = lods[0]![0]!;
    const front = body.position[2] + (body.shape === 'box' ? body.size[2] / 2 : 0);
    expect(anchors.workSurface![2]).toBeGreaterThan(front);
    for (const t of [...anchors.inTray!, ...anchors.outTray!]) expect(t[2]).toBeGreaterThan(front);
  });
});

describe('SF-5 review: next batch, geometry mapping, animation off', () => {
  it('a next batch waits behind the batch on the deck while the cart is out', () => {
    const tr = createPartTracks(geometry, colors);
    tr.ingest([
      rel(0, 1),
      rel(0, 2),
      rel(0, 3),
      enter(1, 1, 'ac'),
      enter(2, 2, 'ac'),
      { t: 10, type: 'batchStarted', equipmentId: 'ac', partIds: [1], endsAt: 70 },
      start(10, 1, 'ac', 70),
      enter(11, 3, 'ac'),
    ]);
    // At 10 s the batch (part 1) is still on the deck in slot 0; part 2 waits behind it.
    const at10 = tr.at(10);
    const key = (p: { x: number; z: number; y: number }) => `${p.x}/${p.y}/${p.z}`;
    expect(key(at10.find((p) => p.partId === 2)!)).not.toBe(key(at10.find((p) => p.partId === 1)!));
    // Once the cart is inside, the deck is free: the queue starts at its first slot again.
    expect(tr.at(40).find((p) => p.partId === 2)).toMatchObject({ x: 38, z: 0 });
  });

  it('buildLineGeometry passes the model anchors through, rotated into plan', () => {
    const project = projectSchema.parse(modelJson);
    const template = project.equipment.find((e) => e.behavior === 'workstation')!;
    const ac = {
      ...template,
      id: 'ac',
      model: 'asc-autoclave',
      position: { x: 10, y: 20 },
      rotation: Math.PI / 2,
      footprint: { width: 2.4, length: 5 },
      height: 2.6,
    };
    const g = buildLineGeometry([ac], []).equipment.get('ac')!;
    const { anchors } = MODELS.find((m) => m.id === 'asc-autoclave')!.build(
      { width: 2.4, length: 5, height: 2.6 },
      {},
    );
    expect(g.workSurface?.y).toBeCloseTo(anchors.workSurface![1], 9);
    expect(g.inTray).toHaveLength(anchors.inTray!.length);
    expect(g.outTray).toHaveLength(anchors.outTray!.length);
    // Travel is |travel| long, along the (rotated) length axis: local -z becomes plan ±x.
    const { travel } = g.cure!;
    expect(Math.hypot(travel.x, travel.z)).toBeCloseTo(anchors.cure!.cart.travel, 9);
    expect(Math.abs(travel.x)).toBeCloseTo(anchors.cure!.cart.travel, 9);
    expect(travel.z).toBeCloseTo(0, 9);
  });

  it('cureState is idle while animation is off, like poses', () => {
    const project = projectSchema.parse(modelJson);
    const r = createRunSession(project, { seed: 1, warmUp: 0, runLength: 1000 });
    if (!r.ok) throw new Error('compile');
    r.session.setAnimate(false);
    expect(r.session.cureState('s1', 0)).toEqual({ door: 1, cart: 0, progress: null });
  });
});
