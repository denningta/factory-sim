import type { RunOptions } from '@factory-sim/sim-engine';

export interface RunSettings {
  warmUpHours: number;
  runLength: number;
  runUnit: 'hours' | 'shifts';
  seedMode: 'fixed' | 'random';
  /** The seed used when `seedMode` is fixed. */
  seed: number;
}

export const DEFAULT_RUN_SETTINGS: RunSettings = {
  warmUpHours: 0,
  runLength: 1,
  runUnit: 'shifts',
  seedMode: 'fixed',
  seed: 1,
};

/** Why the settings can't run, or null. */
export function validateRunSettings(_s: RunSettings): string | null {
  throw new Error('not implemented');
}

/** Engine options in seconds; `seed` is the one used, so a random draw can be shown and re-run. */
export function toRunOptions(
  _s: RunSettings,
  _shiftLength: number,
  _random: () => number = Math.random,
): { options: RunOptions; seed: number } {
  throw new Error('not implemented');
}
