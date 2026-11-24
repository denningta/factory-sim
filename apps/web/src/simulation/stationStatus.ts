import type { LineEvent, StationState } from '@factory-sim/sim-engine';

/** Wireframe 4 colors: working green, starved yellow, blocked red, idle gray. */
export const STATE_COLORS: Record<StationState, string> = {
  working: '#86d9a0',
  starved: '#f6d860',
  blocked: '#ee8c8c',
  idle: '#cfd4dc',
};

export interface StationStates {
  /** Appends engine events (time order); only `stationState` events matter. */
  ingest(events: readonly LineEvent[]): void;
  /** Latest known state per station; absent until the engine has reported one. */
  current(): ReadonlyMap<string, StationState>;
}

export function createStationStates(): StationStates {
  throw new Error('not implemented');
}

/**
 * The constraint: the station with the highest working %. Ties go to the first in `rows`
 * (layout order); null while nobody has worked yet, so nothing is flagged during warm-up.
 */
export function findBottleneck(rows: readonly { id: string; working: number }[]): string | null {
  void rows;
  throw new Error('not implemented');
}
