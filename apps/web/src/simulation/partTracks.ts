import type { Connection, Equipment, PortRef } from '@factory-sim/schema';
import type { LineEvent } from '@factory-sim/sim-engine';
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
   * Poses of every part on the floor at sim time `t`. Any `t` gives the right picture; the
   * per-part cursor is only a cache. A part that has exited is forgotten once drawn gone.
   */
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

  const ingest = (events: readonly LineEvent[]) => {
    for (const ev of events) {
      if (ev.type === 'partReleased') {
        const center = geometry.equipment.get(ev.sourceId)?.center;
        const part: Part = {
          id: ev.partId,
          color: colors.get(ev.productId) ?? '#9ca3af',
          keys: [],
          cursor: 0,
        };
        if (center)
          part.keys.push({
            t: ev.t,
            kind: 'at',
            at: center,
            state: 'processing',
            equipmentId: ev.sourceId,
          });
        else part.keys.push({ t: ev.t, kind: 'gone' });
        parts.set(ev.partId, part);
        continue;
      }
      if (
        ev.type !== 'partMoved' &&
        ev.type !== 'partEntered' &&
        ev.type !== 'partStarted' &&
        ev.type !== 'partExited'
      )
        continue;
      const part = parts.get(ev.partId);
      if (!part) continue;
      if (ev.type === 'partMoved') {
        const seg =
          'connectionId' in ev.via
            ? geometry.connections.get(ev.via.connectionId)
            : geometry.equipment.get(ev.via.equipmentId) &&
              (() => {
                const [from, to] = geometry.equipment.get(
                  (ev.via as { equipmentId: string }).equipmentId,
                )!.path;
                return { from, to };
              })();
        if (seg)
          part.keys.push({
            t: ev.t,
            kind: 'segment',
            t1: ev.arrivesAt,
            from: seg.from,
            to: seg.to,
          });
      } else if (ev.type === 'partEntered') {
        const g = geometry.equipment.get(ev.equipmentId);
        if (g)
          part.keys.push({
            t: ev.t,
            kind: 'at',
            at: g.queueOrigin,
            state: 'queued',
            equipmentId: ev.equipmentId,
          });
      } else if (ev.type === 'partStarted') {
        const g = geometry.equipment.get(ev.equipmentId);
        if (g)
          part.keys.push({
            t: ev.t,
            kind: 'at',
            at: g.center,
            state: 'processing',
            equipmentId: ev.equipmentId,
          });
      } else {
        part.keys.push({ t: ev.t, kind: 'gone' });
      }
    }
  };

  const at = (t: number): PartPose[] => {
    const poses: PartPose[] = [];
    // Waiting parts per station, in arrival order, to assign queue slots.
    const queues = new Map<string, PartPose[]>();
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
        q.push(pose);
        queues.set(k.equipmentId, q);
      }
    }
    for (const [equipmentId, q] of queues) {
      const dir = geometry.equipment.get(equipmentId)!.queueDir;
      // Map iteration is release order, which is arrival order closely enough; sort by the
      // entry time so a later arrival always stands behind an earlier one.
      q.sort((a, b) => entryTime(a.partId) - entryTime(b.partId) || a.partId - b.partId);
      q.forEach((p, slot) => {
        p.x += dir.x * slot * QUEUE_SPACING;
        p.z += dir.z * slot * QUEUE_SPACING;
      });
    }
    return poses;
  };

  const entryTime = (partId: number): number => {
    const part = parts.get(partId)!;
    const k = part.keys[part.cursor]!;
    return k.t;
  };

  return {
    ingest,
    at,
    clear: () => parts.clear(),
  };
}
