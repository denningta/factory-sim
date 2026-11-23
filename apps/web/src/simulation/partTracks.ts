import type { Connection, Equipment, PortRef } from '@factory-sim/schema';
import type { LineEvent, PartInLine } from '@factory-sim/sim-engine';
import { portWorldPosition } from '../layout/ports';

export interface Pt {
  x: number;
  z: number;
}

/** Where parts sit and travel, in plan meters (x, z = floor x, y). */
export interface LineGeometry {
  connections: ReadonlyMap<string, { from: Pt; to: Pt }>;
  equipment: ReadonlyMap<
    string,
    {
      center: Pt;
      /** Where the first waiting part stands, just outside the input port. */
      queueOrigin: Pt;
      /** Unit vector the queue grows along, away from the station. */
      queueDir: Pt;
      /** A conveyor's travel path: input port to output port. */
      path: [Pt, Pt];
    }
  >;
}

export interface PartPose {
  partId: number;
  x: number;
  z: number;
  color: string;
  state: 'moving' | 'queued' | 'processing';
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
  clear(): void;
}

/** Gap between parts waiting in line, meters. */
const QUEUE_SPACING = 0.5;
/** Queue starts this far outside the input port so parts don't sit inside the machine. */
const QUEUE_GAP = 0.4;

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
  const conns = new Map<string, { from: Pt; to: Pt }>();
  for (const c of connections) {
    const from = portPt(c.from);
    const to = portPt(c.to);
    if (from && to) conns.set(c.id, { from, to });
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
    const dx = inPt.x - center.x;
    const dz = inPt.z - center.z;
    const len = Math.hypot(dx, dz);
    const queueDir = len > 1e-9 ? { x: dx / len, z: dz / len } : { x: -1, z: 0 };
    eq.set(e.id, {
      center,
      queueOrigin: { x: inPt.x + queueDir.x * QUEUE_GAP, z: inPt.z + queueDir.z * QUEUE_GAP },
      queueDir,
      path: [inPt, outPt],
    });
  }
  return { connections: conns, equipment: eq };
}

type Key =
  | { t: number; kind: 'segment'; t1: number; from: Pt; to: Pt }
  | { t: number; kind: 'at'; at: Pt; state: 'queued' | 'processing'; equipmentId: string }
  | { t: number; kind: 'gone' };

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
        let seg: { from: Pt; to: Pt } | undefined;
        if ('connectionId' in ev.via) {
          seg = geometry.connections.get(ev.via.connectionId);
        } else {
          const g = geometry.equipment.get(ev.via.equipmentId);
          if (g) seg = { from: g.path[0], to: g.path[1] };
        }
        return seg && { t: ev.t, kind: 'segment', t1: ev.arrivesAt, from: seg.from, to: seg.to };
      }
      case 'partEntered': {
        const g = geometry.equipment.get(ev.equipmentId);
        return (
          g && {
            t: ev.t,
            kind: 'at',
            at: g.queueOrigin,
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
      case 'partExited':
        return { t: ev.t, kind: 'gone' };
      default:
        return undefined;
    }
  };

  const addPart = (partId: number, productId: string, first: Key) =>
    parts.set(partId, {
      id: partId,
      color: colors.get(productId) ?? '#9ca3af',
      keys: [first],
      cursor: 0,
    });

  const ingest = (events: readonly LineEvent[]) => {
    for (const ev of events) {
      const key = keyFor(ev);
      if (!key) continue;
      if (ev.type === 'partReleased') addPart(ev.partId, ev.productId, key);
      else if ('partId' in ev) parts.get(ev.partId)?.keys.push(key);
    }
  };

  const seed = (wip: readonly PartInLine[]) => {
    for (const p of wip) {
      const key = keyFor(p.last);
      if (key) addPart(p.partId, p.productId, key);
    }
  };

  const at = (t: number): PartPose[] => {
    const poses: PartPose[] = [];
    // Waiting parts per station, in arrival order, to assign queue slots.
    const queues = new Map<string, { pose: PartPose; since: number }[]>();
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
        const f = k.t1 > k.t ? Math.min(1, Math.max(0, (t - k.t) / (k.t1 - k.t))) : 1;
        poses.push({
          partId: part.id,
          x: k.from.x + (k.to.x - k.from.x) * f,
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
        color: part.color,
        state: k.state,
      };
      poses.push(pose);
      if (k.state === 'queued') {
        const q = queues.get(k.equipmentId) ?? [];
        q.push({ pose, since: k.t });
        queues.set(k.equipmentId, q);
      }
    }
    for (const [equipmentId, q] of queues) {
      const dir = geometry.equipment.get(equipmentId)!.queueDir;
      // Map iteration is release order, which is arrival order closely enough; sort by the
      // entry time so a later arrival always stands behind an earlier one.
      q.sort((a, b) => a.since - b.since || a.pose.partId - b.pose.partId);
      q.forEach(({ pose: p }, slot) => {
        p.x += dir.x * slot * QUEUE_SPACING;
        p.z += dir.z * slot * QUEUE_SPACING;
      });
    }
    return poses;
  };

  return {
    ingest,
    seed,
    at,
    clear: () => parts.clear(),
  };
}
