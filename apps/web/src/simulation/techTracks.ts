import type { LineEvent, TechInLine } from '@factory-sim/sim-engine';
import type { LineGeometry, Pt } from './partTracks';

export interface TechPose {
  techId: string;
  name: string;
  x: number;
  z: number;
  state: 'walking' | 'standing';
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
}

interface Track {
  info: TechInfo;
  /** Station it stands at before its first recorded walk; changed by `seed`. */
  baseId: string | undefined;
  /** Walks in time order; between them the tech stands where the last one ended. */
  walks: { t: number; t1: number; from: Pt; to: Pt }[];
  cursor: number;
}

export function createTechTracks(geometry: LineGeometry, techs: readonly TechInfo[]): TechTracks {
  // A tech with no station has nowhere to be drawn.
  const tracks = new Map<string, Track>(
    techs
      .filter((info) => info.homeId !== undefined)
      .map((info) => [info.id, { info, baseId: info.homeId, walks: [], cursor: 0 }]),
  );
  const center = (id: string | undefined): Pt =>
    (id !== undefined && geometry.equipment.get(id)?.center) || { x: 0, z: 0 };

  const walkOf = (ev: Extract<LineEvent, { type: 'techMoved' }>) => ({
    t: ev.t,
    t1: ev.arrivesAt,
    from: center(ev.fromId),
    to: center(ev.toId),
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
        if (!last) {
          poses.push({ ...base, ...center(tr.baseId), state: 'standing' });
        } else if (t < last.t1) {
          const f = (t - last.t) / (last.t1 - last.t);
          poses.push({
            ...base,
            x: last.from.x + (last.to.x - last.from.x) * f,
            z: last.from.z + (last.to.z - last.from.z) * f,
            state: 'walking',
          });
        } else {
          poses.push({ ...base, ...last.to, state: 'standing' });
        }
      }
      return poses;
    },
  };
}
