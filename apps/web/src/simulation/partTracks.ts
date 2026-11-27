import type { Connection, Equipment, PortRef } from '@factory-sim/schema';
import type { LineEvent, PartInLine } from '@factory-sim/sim-engine';
import { localToPlan, portWorldPosition } from '../layout/ports';
import { buildModel } from '../equipment/models/registry';
import type { Vec3 } from '../equipment/models/types';
import { getTheme } from '../ui/themeStore';

export interface Pt {
  x: number;
  z: number;
}

/** Where parts sit and travel, in plan meters (x, z = floor x, y). */
export interface LineGeometry {
  connections: ReadonlyMap<string, { from: Pt; to: Pt; fromId?: string; toId?: string }>;
  equipment: ReadonlyMap<
    string,
    {
      center: Pt;
      /** Where a tech stands to work it: the model's operator anchor, else the center. */
      operator: Pt;
      /** Plan direction (unit) the operator at `operator` looks along: toward the bench. */
      facing?: Pt;
      /** Where the i-th waiting part rests (bottom center): the model's queueSlot anchor. */
      queueSlot: (i: number) => Pt3;
      /** A conveyor's travel path: input port to output port. */
      path: [Pt, Pt];
      /** Where the part in process sits (SF-1/SF-7 `workSurface` anchor). */
      workSurface?: Pt3;
      /** Slots where queued parts rest (`inTray`) and finished parts wait (`outTray`). */
      inTray?: Pt3[];
      outTray?: Pt3[];
      /** Autoclave: how far the cart travels into the vessel, in plan meters. */
      cure?: { travel: Pt };
    }
  >;
}

export interface Pt3 extends Pt {
  y: number;
}

export interface PartPose {
  partId: number;
  x: number;
  /** Queued parts: height of the part's bottom at its slot. 0 otherwise (the renderer decides). */
  y: number;
  z: number;
  color: string;
  state: 'moving' | 'queued' | 'processing' | 'finished';
}

export interface CureState {
  /** 1 = open (load, unload), 0 = closed (cure); eased in between. */
  door: number;
  /** 0 = cart out in front of the door, 1 = inside the vessel. */
  cart: number;
  /** 0..1 while curing, null otherwise. */
  progress: number | null;
}

export interface PartTracks {
  /** Appends engine events (time order). Parts whose release was never seen are ignored. */
  ingest(events: readonly LineEvent[]): void;
  /**
   * Poses of every part on the floor at sim time `t`. The per-part cursor is only a cache, so
   * `t` may go back, except past a part's exit: an exited part is forgotten once drawn gone.
   */
  /** Replaces the tracks with the parts in the line now (animation turned back on). */
  seed(wip: readonly PartInLine[]): void;
  at(t: number): PartPose[];
  /** Door, cart and cure progress of a batch station at sim time `t`. */
  cure(equipmentId: string, t: number): CureState;
  /** Parts waiting at each station's input as of the last `at()` call. */
  queueLengths(): ReadonlyMap<string, number>;
  clear(): void;
}

const toPt = (p: { x: number; y: number }): Pt => ({ x: p.x, z: p.y });

export function buildLineGeometry(
  equipment: readonly Equipment[],
  connections: readonly Connection[],
): LineGeometry {
  const byId = new Map(equipment.map((e) => [e.id, e]));
  const portPt = (ref: PortRef): Pt | undefined => {
    const e = byId.get(ref.equipmentId);
    const port = e?.ports.find((p) => p.id === ref.portId);
    return e && port ? toPt(portWorldPosition(e, port)) : undefined;
  };
  const conns = new Map<string, { from: Pt; to: Pt; fromId?: string; toId?: string }>();
  for (const c of connections) {
    const from = portPt(c.from);
    const to = portPt(c.to);
    if (from && to)
      conns.set(c.id, { from, to, fromId: c.from.equipmentId, toId: c.to.equipmentId });
  }
  const eq = new Map<
    string,
    LineGeometry['equipment'] extends ReadonlyMap<string, infer V> ? V : never
  >();
  for (const e of equipment) {
    const center = toPt(e.position);
    const input = e.ports.find((p) => p.kind === 'input');
    const output = e.ports.find((p) => p.kind === 'output');
    const inPt = input ? toPt(portWorldPosition(e, input)) : center;
    const outPt = output ? toPt(portWorldPosition(e, output)) : center;
    const { anchors } = buildModel(e);
    const place = ([x, y, z]: Vec3): Pt3 => {
      const p = localToPlan(e, x, z);
      return { x: p.x, y, z: p.y };
    };
    const op = anchors.operator ? place(anchors.operator) : undefined;
    const [fx, , fz] = anchors.operatorFacing ?? [0, 0, 0];
    const f0 = localToPlan(e, 0, 0);
    const f1 = localToPlan(e, fx, fz);
    const t1 = localToPlan(e, 0, -(anchors.cure?.cart.travel ?? 0));
    eq.set(e.id, {
      center,
      operator: op ? { x: op.x, z: op.z } : center,
      facing: anchors.operatorFacing ? { x: f1.x - f0.x, z: f1.y - f0.y } : undefined,
      queueSlot: (i) => place(anchors.queueSlot(i)),
      path: [inPt, outPt],
      workSurface: anchors.workSurface && place(anchors.workSurface),
      inTray: anchors.inTray?.map(place),
      outTray: anchors.outTray?.map(place),
      cure: anchors.cure && {
        travel: { x: t1.x - f0.x, z: t1.y - f0.y },
      },
    });
  }
  return { connections: conns, equipment: eq };
}

type Key =
  | { t: number; kind: 'segment'; t1: number; from: Pt3; to: Pt3; eased: boolean }
  | {
      t: number;
      kind: 'at';
      at: Pt;
      state: 'queued' | 'processing' | 'finished';
      equipmentId: string;
    }
  | { t: number; kind: 'gone' };

/** Bottom height of a part on the floor or a belt, and of one in process on a bare station. */
const FLOOR_Y = 0.365;
const PROCESSING_Y = 2.265;
/** Parts that overflow a tray stack on its last slot at this pitch (a part is 0.27 m). */
const STACK_PITCH = 0.3;
/** Longest the door and the cart take to move (sim seconds); shorter on a short cure. */
const DOOR_S = 3;

const smooth = (f: number) => f * f * (3 - 2 * f);
const clamp01 = (f: number) => Math.min(1, Math.max(0, f));

type Station = LineGeometry['equipment'] extends ReadonlyMap<string, infer V> ? V : never;

/** The i-th slot of a tray; parts past its last slot stack up on it. */
function traySlot(tray: readonly Pt3[], i: number): Pt3 {
  const last = tray[tray.length - 1]!;
  return i < tray.length ? tray[i]! : { ...last, y: last.y + (i - tray.length + 1) * STACK_PITCH };
}
// Past the tray's slots the queue goes on in the model's own queue grid, so a long queue
// spreads over its levels instead of piling into a tall column on a one-slot tray.
const inSlot = (g: Station, i: number): Pt3 =>
  g.inTray && i < g.inTray.length ? g.inTray[i]! : g.queueSlot(i);
const outSlot = (g: Station, i: number): Pt3 =>
  g.outTray?.length
    ? traySlot(g.outTray, i)
    : { ...g.center, y: (g.workSurface?.y ?? PROCESSING_Y) + i * STACK_PITCH };
const workSlot = (g: Station): Pt3 => g.workSurface ?? { ...g.center, y: PROCESSING_Y };

interface Part {
  id: number;
  color: string;
  keys: Key[];
  cursor: number;
}

export function createPartTracks(
  geometry: LineGeometry,
  colors: ReadonlyMap<string, string>,
): PartTracks {
  const parts = new Map<number, Part>();

  /** The keyframe an event places a part at; undefined if the geometry is unknown. */
  const keyFor = (ev: LineEvent): Key | undefined => {
    switch (ev.type) {
      case 'partReleased': {
        const at = geometry.equipment.get(ev.sourceId)?.center;
        return at && { t: ev.t, kind: 'at', at, state: 'processing', equipmentId: ev.sourceId };
      }
      case 'partMoved': {
        const lift = (p: Pt): Pt3 => ({ ...p, y: FLOOR_Y });
        let seg: { from: Pt3; to: Pt3; eased: boolean } | undefined;
        if ('connectionId' in ev.via) {
          const c = geometry.connections.get(ev.via.connectionId);
          if (c) {
            // Out-tray to in-tray, eased; stations without trays hand over at the port.
            const up = c.fromId ? geometry.equipment.get(c.fromId) : undefined;
            const down = c.toId ? geometry.equipment.get(c.toId) : undefined;
            seg = {
              from: up?.outTray?.length ? outSlot(up, 0) : lift(c.from),
              to: down?.inTray?.length ? inSlot(down, 0) : lift(c.to),
              eased: true,
            };
          }
        } else {
          const g = geometry.equipment.get(ev.via.equipmentId);
          if (g) seg = { from: lift(g.path[0]), to: lift(g.path[1]), eased: false };
        }
        return seg && { t: ev.t, kind: 'segment', t1: ev.arrivesAt, ...seg };
      }
      case 'partEntered': {
        const g = geometry.equipment.get(ev.equipmentId);
        return (
          g && {
            t: ev.t,
            kind: 'at',
            at: g.center, // replaced by the part's queue slot in `at()`
            state: 'queued',
            equipmentId: ev.equipmentId,
          }
        );
      }
      case 'partStarted': {
        const g = geometry.equipment.get(ev.equipmentId);
        return (
          g && {
            t: ev.t,
            kind: 'at',
            at: g.center,
            state: 'processing',
            equipmentId: ev.equipmentId,
          }
        );
      }
      case 'partFinished': {
        const g = geometry.equipment.get(ev.equipmentId);
        return (
          g && {
            t: ev.t,
            kind: 'at',
            at: g.center, // replaced by the part's out-tray slot in `at()`
            state: 'finished',
            equipmentId: ev.equipmentId,
          }
        );
      }
      case 'partExited':
        return { t: ev.t, kind: 'gone' };
      default:
        return undefined;
    }
  };

  const addPart = (partId: number, productId: string, first: Key) =>
    parts.set(partId, {
      id: partId,
      color: colors.get(productId) ?? getTheme().color.muted,
      keys: [first],
      cursor: 0,
    });

  // Recent cure intervals per batch station, from batchStarted (or a batch part's partStarted,
  // which is all wip() keeps, so a re-seeded mid-cure still shows it).
  const cures = new Map<string, { start: number; end: number }[]>();
  const noteCure = (equipmentId: string, start: number, end: number | undefined) => {
    if (end === undefined || !geometry.equipment.get(equipmentId)?.cure) return;
    const list = cures.get(equipmentId) ?? [];
    if (list.some((c) => c.start === start && c.end === end)) return;
    list.push({ start, end });
    if (list.length > 8) list.shift();
    cures.set(equipmentId, list);
  };
  const noteCureEvent = (ev: LineEvent) => {
    if (ev.type === 'batchStarted' || ev.type === 'partStarted')
      noteCure(ev.equipmentId, ev.t, ev.endsAt);
  };

  const cure = (equipmentId: string, t: number): CureState => {
    const list = cures.get(equipmentId);
    let c: { start: number; end: number } | undefined;
    for (let i = (list?.length ?? 0) - 1; i >= 0; i--)
      if (list![i]!.start <= t) {
        c = list![i];
        break;
      }
    if (!c || t >= c.end) return { door: 1, cart: 0, progress: null };
    const d = Math.min(DOOR_S, (c.end - c.start) / 4);
    const progress = (t - c.start) / (c.end - c.start);
    if (t < c.start + d) {
      const f = smooth(clamp01((t - c.start) / d));
      return { door: 1 - f, cart: f, progress };
    }
    if (t > c.end - d) {
      const f = smooth(clamp01((t - (c.end - d)) / d));
      return { door: f, cart: 1 - f, progress };
    }
    return { door: 0, cart: 1, progress };
  };

  const ingest = (events: readonly LineEvent[]) => {
    for (const ev of events) {
      noteCureEvent(ev);
      const key = keyFor(ev);
      if (!key) continue;
      if (ev.type === 'partReleased') addPart(ev.partId, ev.productId, key);
      else if ('partId' in ev) parts.get(ev.partId)?.keys.push(key);
    }
  };

  const seed = (wip: readonly PartInLine[]) => {
    for (const p of wip) {
      noteCureEvent(p.last);
      const key = keyFor(p.last);
      if (key) addPart(p.partId, p.productId, key);
    }
  };

  let lengths: ReadonlyMap<string, number> = new Map();
  const at = (t: number): PartPose[] => {
    const poses: PartPose[] = [];
    // Parts resting at a station, per station and state, to assign slots in arrival order.
    const groups = new Map<string, { pose: PartPose; since: number; equipmentId: string }[]>();
    for (const part of parts.values()) {
      const { keys } = part;
      if (keys[0]!.t > t) continue;
      let i = part.cursor;
      if (keys[i]!.t > t) i = 0;
      while (i + 1 < keys.length && keys[i + 1]!.t <= t) i++;
      part.cursor = i;
      const k = keys[i]!;
      if (k.kind === 'gone') {
        parts.delete(part.id);
        continue;
      }
      if (k.kind === 'segment') {
        const raw = k.t1 > k.t ? clamp01((t - k.t) / (k.t1 - k.t)) : 1;
        const f = k.eased ? smooth(raw) : raw;
        poses.push({
          partId: part.id,
          x: k.from.x + (k.to.x - k.from.x) * f,
          y: k.from.y + (k.to.y - k.from.y) * f,
          z: k.from.z + (k.to.z - k.from.z) * f,
          color: part.color,
          state: 'moving',
        });
        continue;
      }
      const pose: PartPose = {
        partId: part.id,
        x: k.at.x,
        z: k.at.z,
        y: 0,
        color: part.color,
        state: k.state,
      };
      poses.push(pose);
      const g = geometry.equipment.get(k.equipmentId)!;
      if (k.state === 'processing' && !g.cure) {
        Object.assign(pose, workSlot(g));
        continue;
      }
      const key = `${k.equipmentId}|${k.state}`;
      const q = groups.get(key) ?? [];
      q.push({ pose, since: k.t, equipmentId: k.equipmentId });
      groups.set(key, q);
    }
    const queued = new Map<string, number>();
    for (const q of groups.values()) {
      // Map iteration is release order, which is arrival order closely enough; sort by the
      // entry time so a later arrival always stands behind an earlier one.
      q.sort((a, b) => a.since - b.since || a.pose.partId - b.pose.partId);
      const { equipmentId } = q[0]!;
      const g = geometry.equipment.get(equipmentId)!;
      const state = q[0]!.pose.state;
      if (state === 'queued') queued.set(equipmentId, q.length);
      // A batch rides the cart from where it waited into the vessel.
      const c = state === 'processing' ? cure(equipmentId, t).cart : 0;
      // While the cart is out the batch is on the deck: the next batch waits behind it.
      const behind =
        state === 'queued' && g.cure && cure(equipmentId, t).cart < 1
          ? (groups.get(`${equipmentId}|processing`)?.length ?? 0)
          : 0;
      q.forEach(({ pose: p }, slot) => {
        Object.assign(p, state === 'finished' ? outSlot(g, slot) : inSlot(g, slot + behind));
        if (c > 0 && g.cure) {
          p.x += g.cure.travel.x * c;
          p.z += g.cure.travel.z * c;
        }
      });
    }
    lengths = queued;
    return poses;
  };

  return {
    ingest,
    seed,
    at,
    cure,
    queueLengths: () => lengths,
    clear: () => parts.clear(),
  };
}
