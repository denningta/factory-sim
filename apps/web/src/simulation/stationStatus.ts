import type { LineEvent, StationState } from '@factory-sim/sim-engine';

/** Wireframe 4 colors: working green, starved yellow, blocked red, idle gray. */
export const STATE_COLORS: Record<StationState, string> = {
  working: '#86d9a0',
  starved: '#f6d860',
  blocked: '#ee8c8c',
  idle: '#cfd4dc',
};

/** Neutral until the engine has reported a state for the station. */
export const NO_STATE_COLOR = '#e5e7eb';

export const plateColor = (state: StationState | undefined): string =>
  state ? STATE_COLORS[state] : NO_STATE_COLOR;

export interface StationStates {
  /** Appends engine events (time order); only `stationState` events matter. */
  ingest(events: readonly LineEvent[]): void;
  /** Latest known state per station; absent until the engine has reported one. */
  current(): ReadonlyMap<string, StationState>;
}

export function createStationStates(): StationStates {
  const states = new Map<string, StationState>();
  return {
    ingest(events) {
      for (const ev of events) if (ev.type === 'stationState') states.set(ev.stationId, ev.state);
    },
    current: () => states,
  };
}

/**
 * The constraint: the station with the highest working %. Ties go to the first in `rows`
 * (placement order); null while nobody has worked yet, so nothing is flagged during warm-up.
 */
export function findBottleneck(rows: readonly { id: string; working: number }[]): string | null {
  let best: string | null = null;
  let max = 0;
  for (const r of rows) {
    if (r.working > max) {
      max = r.working;
      best = r.id;
    }
  }
  return best;
}

/** The tile text: the bottleneck's name and working %, or null while none is flagged. */
export function bottleneckSummary(
  rows: readonly { id: string; name: string; working: number }[],
): { name: string; working: number } | null {
  const id = findBottleneck(rows);
  const row = rows.find((r) => r.id === id);
  return row ? { name: row.name, working: row.working } : null;
}
