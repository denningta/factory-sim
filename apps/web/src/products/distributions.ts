import type { Duration } from '@factory-sim/schema';

export interface Histogram {
  /** Counts per equal-width bin over [0, max]. */
  bins: { from: number; to: number; count: number }[];
  samples: number;
}

export function sampleDuration(_d: Duration, _rng: { next(): number }): number {
  throw new Error('not implemented');
}

export function previewHistogram(
  _d: Duration,
  _opts?: { samples?: number; bins?: number },
): Histogram {
  throw new Error('not implemented');
}
