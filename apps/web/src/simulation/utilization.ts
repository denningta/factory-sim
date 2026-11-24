import type { RunStats } from '@factory-sim/sim-engine';

export type StationKey = 'working' | 'starved' | 'blocked' | 'idle';
export type TechKey = 'working' | 'walking' | 'idle';

/** One table row: percentages (0–100) of the measured window, keyed by state. */
export type UtilRow<K extends string> = { id: string; name: string } & Record<K, number>;

export function stationUtilization(
  _stats: RunStats,
  _stations: { id: string; name: string }[],
): UtilRow<StationKey>[] {
  throw new Error('not implemented');
}

export function techUtilization(
  _stats: RunStats,
  _techs: { id: string; name: string }[],
): UtilRow<TechKey>[] {
  throw new Error('not implemented');
}

export type SortState<K extends string> = { key: 'name' | K; dir: 'asc' | 'desc' };

export function sortRows<K extends string>(_rows: UtilRow<K>[], _sort: SortState<K>): UtilRow<K>[] {
  throw new Error('not implemented');
}
