import type { LineEvent, TechInLine } from '@factory-sim/sim-engine';
import type { LineGeometry, Pt } from './partTracks';

export interface TechPose {
  techId: string;
  name: string;
  x: number;
  z: number;
  state: 'walking' | 'standing';
  /** Yaw in radians about +y; 0 faces +z. The direction of travel, or the bench while standing. */
  heading: number;
  /** Meters walked so far in the current walk (0 standing): drives the walk cycle (ADR-0008). */
  walked: number;
}

export interface TechTracks {
  /** Appends engine events (time order). */
  ingest(events: readonly LineEvent[]): void;
  /** Drops recorded walks and restarts every tech from `run.techs()` (events were off). */
  seed(techs: readonly TechInLine[]): void;
  /** Where every tech is at sim time `t`. */
  at(t: number): TechPose[];
}

export interface TechInfo {
  id: string;
  name: string;
  /** Station the tech starts at (the first one it is assigned to). */
  homeId: string | undefined;
  /** Every station the tech is assigned to: side-by-side spots at a bench are shared out by it. */
  stationIds?: readonly string[];
}

interface Track {
  info: TechInfo;
  /** Station it stands at before its first recorded walk; changed by `seed`. */
  baseId: string | undefined;
  /** Walks in time order; between them the tech stands where the last one ended. */
  walks: { t: number; t1: number; from: Pt; to: Pt; toId: string }[];
  cursor: number;
}

/** Side-by-side spacing of techs at one bench along its front edge (m). */
export const TECH_SPACING = 0.7;

export function createTechTracks(geometry: LineGeometry, techs: readonly TechInfo[]): TechTracks {
  // A tech with no station has nowhere to be drawn.
  const tracks = new Map<string, Track>(
    techs
      .filter((info) => info.homeId !== undefined)
      .map((info) => [info.id, { info, baseId: info.homeId, walks: [], cursor: 0 }]),
  );
  // Techs sharing a bench take fixed spots along its front edge, so nobody overlaps and the
  // spot doesn't change while others walk away.
  const sharing = new Map<string, string[]>();
  for (const info of techs)
    for (const sid of info.stationIds ?? [])
      sharing.set(sid, [...(sharing.get(sid) ?? []), info.id]);

  /** Unit plan direction a tech at `id` looks along: toward the bench. */
  const facingAt = (id: string | undefined): Pt => {
    const g = id !== undefined ? geometry.equipment.get(id) : undefined;
    if (!g) return { x: 0, z: 1 };
    const f = g.facing ?? { x: g.center.x - g.operator.x, z: g.center.z - g.operator.z };
    const len = Math.hypot(f.x, f.z);
    return len > 1e-9 ? { x: f.x / len, z: f.z / len } : { x: 0, z: 1 };
  };
  const yawOf = (d: Pt) => Math.atan2(d.x, d.z);

  // Techs stand at the station's operator anchor (UI-7), shifted along the front edge.
  const spot = (stationId: string | undefined, techId: string): Pt => {
    const g = stationId !== undefined ? geometry.equipment.get(stationId) : undefined;
    if (!g) return { x: 0, z: 0 };
    const group = stationId !== undefined ? sharing.get(stationId) : undefined;
    const idx = group?.indexOf(techId) ?? -1;
    if (!group || idx < 0) return g.operator;
    const side = (idx - (group.length - 1) / 2) * TECH_SPACING;
    const f = facingAt(stationId);
    return { x: g.operator.x - f.z * side, z: g.operator.z + f.x * side };
  };

  const walkOf = (ev: Extract<LineEvent, { type: 'techMoved' }>) => ({
    t: ev.t,
    t1: ev.arrivesAt,
    from: spot(ev.fromId, ev.techId),
    to: spot(ev.toId, ev.techId),
    toId: ev.toId,
  });

  return {
    seed(list) {
      for (const tr of tracks.values()) {
        tr.walks = [];
        tr.cursor = 0;
      }
      for (const t of list) {
        const tr = tracks.get(t.techId);
        if (!tr) continue;
        tr.baseId = t.atId ?? tr.info.homeId;
        if (t.walk) tr.walks.push(walkOf(t.walk));
      }
    },
    ingest(events) {
      for (const ev of events) {
        if (ev.type !== 'techMoved') continue;
        tracks.get(ev.techId)?.walks.push(walkOf(ev));
      }
    },
    at(t) {
      const poses: TechPose[] = [];
      for (const tr of tracks.values()) {
        const { walks } = tr;
        let i = tr.cursor;
        if (i > 0 && walks[i - 1]!.t > t) i = 0;
        while (i < walks.length && walks[i]!.t <= t) i++;
        tr.cursor = i;
        const last = walks[i - 1];
        const base = { techId: tr.info.id, name: tr.info.name };
        if (last && t < last.t1) {
          const dx = last.to.x - last.from.x;
          const dz = last.to.z - last.from.z;
          const len = Math.hypot(dx, dz);
          const f = (t - last.t) / (last.t1 - last.t);
          poses.push({
            ...base,
            x: last.from.x + dx * f,
            z: last.from.z + dz * f,
            state: 'walking',
            heading: len > 1e-9 ? yawOf({ x: dx, z: dz }) : yawOf(facingAt(last.toId)),
            walked: len * f,
          });
        } else {
          const at = last ? last.toId : tr.baseId;
          poses.push({
            ...base,
            ...(last ? last.to : spot(tr.baseId, tr.info.id)),
            state: 'standing',
            heading: yawOf(facingAt(at)),
            walked: 0,
          });
        }
      }
      return poses;
    },
  };
}
