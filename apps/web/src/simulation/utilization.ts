import type { RunStats } from '@factory-sim/sim-engine';

export type StationKey = 'working' | 'starved' | 'blocked' | 'idle';
export type TechKey = 'working' | 'walking' | 'idle';

/** One table row: percentages (0–100) of the measured window, keyed by state. */
export type UtilRow<K extends string> = { id: string; name: string } & Record<K, number>;

const STATION_KEYS: StationKey[] = ['working', 'starved', 'blocked', 'idle'];
const TECH_KEYS: TechKey[] = ['working', 'walking', 'idle'];

function rows<K extends string>(
  fractions: Record<string, Record<K, number>>,
  named: readonly { id: string; name: string }[],
  keys: K[],
): UtilRow<K>[] {
  // Only objects the engine reports on (e.g. workstations, not every piece of equipment).
  return named
    .filter((n) => fractions[n.id])
    .map((n) => {
      const f = fractions[n.id]!;
      const row = { id: n.id, name: n.name } as UtilRow<K>;
      for (const k of keys) (row as Record<K, number>)[k] = f[k] * 100;
      return row;
    });
}

/** Engine fractions of the measured window → percentages for the station table (AN-2). */
export const stationUtilization = (
  stats: RunStats,
  stations: readonly { id: string; name: string }[],
) => rows(stats.stations, stations, STATION_KEYS);

export const techUtilization = (stats: RunStats, techs: { id: string; name: string }[]) =>
  rows(stats.techs, techs, TECH_KEYS);

export type SortState<K extends string> = { key: 'name' | K; dir: 'asc' | 'desc' };

/** A sorted copy; ties keep their original order (Array.sort is stable). */
export function sortRows<K extends string>(list: UtilRow<K>[], sort: SortState<K>): UtilRow<K>[] {
  const sign = sort.dir === 'asc' ? 1 : -1;
  return [...list].sort((a, b) =>
    sort.key === 'name'
      ? sign * a.name.localeCompare(b.name, undefined, { numeric: true })
      : sign * (a[sort.key] - b[sort.key]),
  );
}
