import type { Duration } from '@factory-sim/schema';
import { createRng } from '@factory-sim/sim-engine';

export interface Histogram {
  /** Equal-width bins from the smallest to the largest sample; `from` is never below 0. */
  bins: { from: number; to: number; count: number }[];
  samples: number;
}

/**
 * One draw from `d`, in seconds, truncated at 0 (WS-2 AC3). Preview only: the simulation samples
 * in the engine (SE-6), so this may use Math.log/cos without the engine's bit-exactness rules.
 */
export function sampleDuration(d: Duration, rng: { next(): number }): number {
  // 1 - next() is in (0, 1], so log() never sees 0.
  const normal = () =>
    Math.sqrt(-2 * Math.log(1 - rng.next())) * Math.cos(2 * Math.PI * rng.next());
  switch (d.kind) {
    case 'fixed':
      return d.value;
    case 'normal':
      return Math.max(0, d.mean + d.stdDev * normal());
    case 'triangular': {
      const u = rng.next();
      const cut = (d.mode - d.min) / (d.max - d.min);
      return u < cut
        ? d.min + Math.sqrt(u * (d.max - d.min) * (d.mode - d.min))
        : d.max - Math.sqrt((1 - u) * (d.max - d.min) * (d.max - d.mode));
    }
    case 'lognormal': {
      // Convert the duration's own mean/stdDev to the underlying normal's parameters.
      const variance = Math.log(1 + (d.stdDev / d.mean) ** 2);
      return Math.exp(Math.log(d.mean) - variance / 2 + Math.sqrt(variance) * normal());
    }
    case 'exponential':
      return -d.mean * Math.log(1 - rng.next());
  }
}

/** Histogram of seeded samples, so the same parameters always draw the same picture. */
export function previewHistogram(
  d: Duration,
  { samples = 2000, bins = 20 }: { samples?: number; bins?: number } = {},
): Histogram {
  const rng = createRng(1);
  const xs = Array.from({ length: samples }, () => sampleDuration(d, rng));
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  const width = (hi > lo ? hi - lo : 1) / bins;
  const out = Array.from({ length: bins }, (_, i) => ({
    from: lo + i * width,
    to: lo + (i + 1) * width,
    count: 0,
  }));
  for (const x of xs) out[Math.min(bins - 1, Math.floor((x - lo) / width))]!.count++;
  return { bins: out, samples };
}
