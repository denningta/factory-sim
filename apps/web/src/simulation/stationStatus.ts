import type { LineEvent, StationState } from '@factory-sim/sim-engine';
import { getTheme } from '../ui/themeStore';
import type { Theme } from '../ui/tokens';

/** Station-state fills (tints) from the design tokens: working green, starved yellow, blocked red, idle gray. */
export const stateColors = (t: Theme = getTheme()): Record<StationState, string> => ({
  working: t.state.working.tint,
  starved: t.state.starved.tint,
  blocked: t.state.blocked.tint,
  idle: t.state.waiting.tint,
});

/** Neutral until the engine has reported a state for the station. */
export const noStateColor = (t: Theme = getTheme()): string => t.color.border;

export const plateColor = (state: StationState | undefined): string =>
  state ? stateColors()[state] : noStateColor();

export interface StationStates {
  /** Appends engine events (time order); only `stationState` events matter. */
  ingest(events: readonly LineEvent[]): void;
  /** Replaces all states with the engine's current ones (events aren't recorded while animation is off). */
  seed(states: Readonly<Record<string, StationState>>): void;
  /** Latest known state per station; absent until the engine has reported one. */
  current(): ReadonlyMap<string, StationState>;
}

export function createStationStates(): StationStates {
  const states = new Map<string, StationState>();
  return {
    ingest(events) {
      for (const ev of events) if (ev.type === 'stationState') states.set(ev.stationId, ev.state);
    },
    seed(next) {
      states.clear();
      for (const [id, state] of Object.entries(next)) states.set(id, state);
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

/** What the user sees for an engine state: the engine's `idle` is "Waiting for tech". */
export const stateLabel = (_state: StationState): string => {
  throw new Error('not implemented');
};

/** Stack-light segments, bottom to top; exactly one is lit per state. */
export type LightSegment = 'working' | 'starved' | 'blocked' | 'waiting';
export const lightSegments = (
  _state: StationState | undefined,
  _t: Theme = getTheme(),
): { segment: LightSegment; color: string; lit: boolean }[] => {
  throw new Error('not implemented');
};
