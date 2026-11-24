import type { RunOptions } from '@factory-sim/sim-engine';

export interface RunSettings {
  warmUpHours: number;
  runLength: number;
  runUnit: 'hours' | 'shifts';
  seedMode: 'fixed' | 'random';
  /** The seed used when `seedMode` is fixed. */
  seed: number;
}

/** The engine's PRNG takes a 32-bit seed. */
export const MAX_SEED = 2 ** 32 - 1;

export const DEFAULT_RUN_SETTINGS: RunSettings = {
  warmUpHours: 0,
  runLength: 1,
  runUnit: 'shifts',
  seedMode: 'fixed',
  seed: 1,
};

/** Why the settings can't run, or null. */
export function validateRunSettings(s: RunSettings): string | null {
  if (!(Number.isFinite(s.warmUpHours) && s.warmUpHours >= 0)) return 'Warm-up must be 0 or more';
  if (!(Number.isFinite(s.runLength) && s.runLength > 0)) return 'Run length must be more than 0';
  if (s.seedMode === 'fixed' && !(Number.isInteger(s.seed) && s.seed >= 0 && s.seed <= MAX_SEED))
    return `Seed must be a whole number from 0 to ${MAX_SEED}`;
  return null;
}

/** Engine options in seconds; `seed` is the one used, so a random draw can be shown and re-run. */
export function toRunOptions(
  s: RunSettings,
  shiftLength: number,
  random: () => number = Math.random,
): { options: RunOptions; seed: number } {
  const seed = s.seedMode === 'random' ? Math.floor(random() * 2 ** 31) : s.seed;
  const unit = s.runUnit === 'shifts' ? shiftLength : 3600;
  return { options: { seed, warmUp: s.warmUpHours * 3600, runLength: s.runLength * unit }, seed };
}
