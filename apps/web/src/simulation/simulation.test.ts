import { describe, expect, it } from 'vitest';
import { createProject, type Project } from '@factory-sim/schema';
import { compileLine, createRun, type LineEvent, type Run } from '@factory-sim/sim-engine';
import { createEditorStore } from '../layout/editorStore';
import { buildLineGeometry, createPartTracks, type LineGeometry } from './partTracks';
import { createPlayback } from './playback';
import { createRunSession } from './runSession';

const A = { x: 0, z: 0 };
const B = { x: 10, z: 0 };
const geometry: LineGeometry = {
  connections: new Map([['c1', { from: A, to: B }]]),
  equipment: new Map([
    ['src', { center: A, queueOrigin: A, queueDir: { x: -1, z: 0 }, path: [A, A] }],
    [
      'ws',
      {
        center: B,
        queueOrigin: { x: 8, z: 0 },
        queueDir: { x: -1, z: 0 },
        path: [B, B],
      },
    ],
    [
      'belt',
      {
        center: { x: 20, z: 0 },
        queueOrigin: A,
        queueDir: { x: -1, z: 0 },
        path: [B, { x: 30, z: 0 }],
      },
    ],
  ]),
};
const colors = new Map([
  ['p1', '#3b82f6'],
  ['p2', '#f97316'],
]);
const release = (t: number, partId: number, productId: string): LineEvent => ({
  t,
  type: 'partReleased',
  partId,
  productId,
  sourceId: 'src',
});
const move = (t: number, partId: number, arrivesAt: number): LineEvent => ({
  t,
  type: 'partMoved',
  partId,
  via: { connectionId: 'c1' },
  arrivesAt,
});

describe('SE-3 AC1: parts are drawn in their product color, moving along connections', () => {
  it('colors each part by its product', () => {
    const tr = createPartTracks(geometry, colors);
    tr.ingest([release(0, 1, 'p1'), move(0, 1, 10), release(1, 2, 'p2'), move(1, 2, 11)]);
    const poses = tr.at(2);
    expect(poses.find((p) => p.partId === 1)?.color).toBe('#3b82f6');
    expect(poses.find((p) => p.partId === 2)?.color).toBe('#f97316');
  });

  it('interpolates along the connection between departure and arrival', () => {
    const tr = createPartTracks(geometry, colors);
    tr.ingest([release(0, 1, 'p1'), move(0, 1, 10)]);
    const at = (t: number) => tr.at(t)[0]!;
    expect(at(0)).toMatchObject({ x: 0, z: 0, state: 'moving' });
    expect(at(5).x).toBeCloseTo(5);
    expect(at(10).x).toBeCloseTo(10);
  });

  it('moves along a conveyor footprint path', () => {
    const tr = createPartTracks(geometry, colors);
    tr.ingest([
      release(0, 1, 'p1'),
      { t: 0, type: 'partMoved', partId: 1, via: { equipmentId: 'belt' }, arrivesAt: 20 },
    ]);
    expect(tr.at(10)[0]!.x).toBeCloseTo(20);
  });

  it('is correct when time moves backward (reset/seek): the cursor is only a cache', () => {
    const tr = createPartTracks(geometry, colors);
    tr.ingest([release(0, 1, 'p1'), move(0, 1, 10), move(10, 1, 20)]);
    tr.at(15);
    expect(tr.at(5)[0]!.x).toBeCloseTo(5);
  });

  it('removes a part when it exits and ignores parts it never saw released', () => {
    const tr = createPartTracks(geometry, colors);
    tr.ingest([
      release(0, 1, 'p1'),
      move(0, 1, 10),
      { t: 10, type: 'partExited', partId: 1, sinkId: 'sink' },
      move(0, 99, 10),
    ]);
    expect(tr.at(5)).toHaveLength(1);
    expect(tr.at(10.5)).toHaveLength(0);
  });

  it('draws nothing before its release time', () => {
    const tr = createPartTracks(geometry, colors);
    tr.ingest([release(5, 1, 'p1')]);
    expect(tr.at(1)).toHaveLength(0);
  });
});

describe('SE-3 AC1: parts queue at stations', () => {
  const enter = (t: number, partId: number): LineEvent => ({
    t,
    type: 'partEntered',
    partId,
    equipmentId: 'ws',
  });
  it('lines waiting parts up behind the input, in arrival order', () => {
    const tr = createPartTracks(geometry, colors);
    tr.ingest([
      release(0, 1, 'p1'),
      move(0, 1, 10),
      enter(10, 1),
      release(1, 2, 'p2'),
      move(1, 2, 11),
      enter(11, 2),
    ]);
    const p1 = tr.at(12).find((p) => p.partId === 1)!;
    const p2 = tr.at(12).find((p) => p.partId === 2)!;
    expect(p1).toMatchObject({ state: 'queued', x: 8 });
    expect(p2.state).toBe('queued');
    expect(p2.x).toBeLessThan(p1.x);
  });

  it('moves the head of the queue to the station when it starts and closes the gap', () => {
    const tr = createPartTracks(geometry, colors);
    tr.ingest([
      release(0, 1, 'p1'),
      enter(1, 1),
      release(0, 2, 'p2'),
      enter(2, 2),
      { t: 3, type: 'partStarted', partId: 1, equipmentId: 'ws', endsAt: 8 },
    ]);
    const poses = tr.at(4);
    expect(poses.find((p) => p.partId === 1)).toMatchObject({ state: 'processing', x: 10 });
    expect(poses.find((p) => p.partId === 2)).toMatchObject({ state: 'queued', x: 8 });
  });
});

describe('buildLineGeometry', () => {
  it('maps connections to port positions and stations to a queue behind the input', () => {
    const store = createEditorStore();
    const s = store.getState;
    const src = s().placeEquipment('base-source', { x: 0, y: 0 })!;
    const ws = s().placeEquipment('base-workstation', { x: 4, y: 0 })!;
    s().connect({ equipmentId: src.id, portId: 'out' }, { equipmentId: ws.id, portId: 'in' });
    const g = buildLineGeometry(s().equipment, s().connections);
    const c = s().connections[0]!;
    expect(g.connections.get(c.id)).toBeDefined();
    const w = g.equipment.get(ws.id)!;
    expect(w.center).toEqual({ x: 4, z: 0 });
    // The queue starts at the input port and runs away from the station center.
    const inPort = { x: 4 + 0, z: 0 };
    expect(Math.hypot(w.queueOrigin.x - inPort.x, w.queueOrigin.z - inPort.z)).toBeGreaterThan(0);
    expect(Math.hypot(w.queueDir.x, w.queueDir.z)).toBeCloseTo(1);
  });
});

/** A real source → station → sink line. */
function realLine(): { project: Project; geometry: LineGeometry; colors: Map<string, string> } {
  const store = createEditorStore();
  const s = store.getState;
  const src = s().placeEquipment('base-source', { x: 0, y: 0 })!;
  const ws = s().placeEquipment('base-workstation', { x: 6, y: 0 })!;
  const sink = s().placeEquipment('base-sink', { x: 12, y: 0 })!;
  s().connect({ equipmentId: src.id, portId: 'out' }, { equipmentId: ws.id, portId: 'in' });
  s().connect({ equipmentId: ws.id, portId: 'out' }, { equipmentId: sink.id, portId: 'in' });
  const p = s().addProduct();
  s().addRoutingStep(p.id, ws.id);
  s().setCycleTime(p.id, ws.id, 5);
  s().setReleaseInterval(4);
  const tech = s().addTechnician();
  s().setTechnicianStation(tech.id, ws.id, true);
  const st = s();
  const project: Project = {
    ...createProject(),
    floor: st.floor,
    equipment: st.equipment,
    connections: st.connections,
    products: st.products,
    cycleTimes: st.cycleTimes,
    technicians: st.technicians,
    demand: st.demand,
    release: st.release,
  };
  return {
    project,
    geometry: buildLineGeometry(st.equipment, st.connections),
    colors: new Map(st.products.map((q) => [q.id, q.color])),
  };
}
function newRun(project: Project): Run {
  const c = compileLine(project);
  if (!c.ok) throw new Error(c.issues.map((i) => i.message).join('; '));
  return createRun(c.model, { seed: 1, warmUp: 0, runLength: 1000 });
}

describe('SE-3 AC2: animation stays in sync with the simulation clock at any speed', () => {
  const posesAfter = (speed: number, frames: number, dt: number) => {
    const { project, geometry: g, colors: c } = realLine();
    const pb = createPlayback(newRun(project), g, c);
    pb.speed = speed;
    for (let i = 0; i < frames; i++) pb.advance(dt);
    return { now: pb.run.now, poses: pb.tracks.at(pb.run.now) };
  };

  it.each([1, 10, 100, 1000])('sim clock advances wall time × speed (%dx)', (speed) => {
    const { now } = posesAfter(speed, 30, 1 / 60);
    expect(now).toBeCloseTo(0.5 * speed, 6);
  });

  it('shows the same picture for the same sim time regardless of frame rate', () => {
    const coarse = posesAfter(9, 1, 1);
    const fine = posesAfter(9, 60, 1 / 60);
    expect(fine.now).toBeCloseTo(coarse.now);
    expect(fine.poses.length).toBeGreaterThan(0);
    expect(fine.poses).toEqual(coarse.poses);
  });

  it('does not run ahead of the sim clock: no part is drawn beyond what has happened', () => {
    const { poses } = posesAfter(1, 60 * 12, 1 / 60);
    for (const p of poses) expect(Number.isFinite(p.x) && Number.isFinite(p.z)).toBe(true);
    expect(poses.some((p) => p.state === 'processing' || p.state === 'queued')).toBe(true);
  });
});

describe('SE-3 AC3: animation can be turned off for speed', () => {
  it('records no events and draws no parts while off, and results are unchanged', () => {
    const { project, geometry: g, colors: c } = realLine();
    const off = createPlayback(newRun(project), g, c);
    off.animate = false;
    let ticks = 0;
    while (!off.run.done && ticks++ < 10_000) off.advance(1 / 60);
    expect(off.run.done).toBe(true);
    expect(off.tracks.at(off.run.now)).toHaveLength(0);
    // The engine itself records nothing while off (this fails if setEventsEnabled is dropped).
    expect(off.run.drainEvents()).toEqual([]);

    const ref = newRun(project);
    ref.runUntil(ref.endTime);
    expect(off.run.stats()).toEqual(ref.stats());
  });

  it('runs faster than the animated clock: a frame covers many sim seconds', () => {
    const { project, geometry: g, colors: c } = realLine();
    const off = createPlayback(newRun(project), g, c);
    off.animate = false;
    off.advance(1 / 60);
    expect(off.run.now).toBeGreaterThan(10);
  });

  it('turning animation back on resumes drawing new parts', () => {
    const { project, geometry: g, colors: c } = realLine();
    const pb = createPlayback(newRun(project), g, c, { sliceMs: 0 });
    pb.animate = false;
    pb.advance(1 / 60);
    pb.animate = true;
    for (let i = 0; i < 600; i++) pb.advance(1 / 60);
    expect(pb.tracks.at(pb.run.now).length).toBeGreaterThan(0);
  });

  it('turning it back on re-seeds parts already in the line from wip()', () => {
    const { project, geometry: g, colors: c } = realLine();
    const pb = createPlayback(newRun(project), g, c, { sliceMs: 0 });
    pb.animate = false;
    pb.advance(1 / 60); // 60 sim seconds, parts in the line
    const inLine = pb.run.wip().length;
    expect(inLine).toBeGreaterThan(0);
    pb.animate = true;
    expect(pb.run.drainEvents()).toEqual([]); // nothing new yet: only the seed shows them
    expect(pb.tracks.at(pb.run.now)).toHaveLength(inLine);
  });

  it('events appear again after turning animation back on', () => {
    const { project, geometry: g, colors: c } = realLine();
    const pb = createPlayback(newRun(project), g, c, { sliceMs: 0 });
    pb.animate = false;
    pb.advance(1 / 60);
    pb.animate = true;
    pb.run.runUntil(pb.run.now + 10);
    expect(pb.run.drainEvents().length).toBeGreaterThan(0);
  });
});

describe('RunSession: the interface SE-2, SE-4 and AN-1 build on', () => {
  const session = (opts = { seed: 1, warmUp: 0, runLength: 1000 }) =>
    createRunSession(realLine().project, opts);

  it('rejects a model that does not compile, with its issues', () => {
    const r = createRunSession(createProject(), { seed: 1, warmUp: 0, runLength: 10 });
    expect(r.ok).toBe(false);
  });

  it('play advances with frames, pause holds the clock', () => {
    const r = session();
    if (!r.ok) throw new Error('compile');
    const s = r.session;
    s.setSpeed(10);
    s.frame(1);
    expect(s.now).toBe(0); // paused
    s.play();
    expect(s.playing).toBe(true);
    s.frame(1);
    expect(s.now).toBeCloseTo(10);
    s.pause();
    s.frame(1);
    expect(s.now).toBeCloseTo(10);
  });

  it('step moves to the next change and shows parts; reset starts over; seed from the caller', () => {
    const r = session();
    if (!r.ok) throw new Error('compile');
    const s = r.session;
    s.step();
    expect(s.poses(s.now).length).toBeGreaterThan(0);
    const stats = () => JSON.stringify(s.stats());
    s.play();
    s.frame(5);
    const after = stats();
    s.reset();
    expect(s.now).toBe(0);
    expect(s.playing).toBe(false);
    s.play();
    s.frame(5);
    expect(stats()).toBe(after); // same seed ⇒ same run
  });

  it('stops playing at the end of the run, and subscribers are told of changes', () => {
    const r = session({ seed: 1, warmUp: 0, runLength: 30 });
    if (!r.ok) throw new Error('compile');
    const s = r.session;
    let calls = 0;
    const off = s.subscribe(() => calls++);
    s.setSpeed(100);
    s.play();
    s.frame(1);
    expect(s.done).toBe(true);
    expect(s.playing).toBe(false);
    expect(calls).toBeGreaterThan(0);
    off();
  });

  it('animation off keeps results the same and shows no parts', () => {
    const r = session();
    if (!r.ok) throw new Error('compile');
    const s = r.session;
    s.setAnimate(false);
    s.play();
    for (let i = 0; i < 1000 && !s.done; i++) s.frame(1 / 60);
    expect(s.done).toBe(true);
    expect(s.poses(s.now)).toHaveLength(0);
    const ref = createRunSession(realLine().project, { seed: 1, warmUp: 0, runLength: 1000 });
    if (!ref.ok) throw new Error('compile');
    ref.session.setSpeed(1000);
    ref.session.play();
    for (let i = 0; i < 100000 && !ref.session.done; i++) ref.session.frame(1);
    expect(s.stats()).toEqual(ref.session.stats());
  });
});
