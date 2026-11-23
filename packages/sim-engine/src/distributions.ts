import type { Duration } from '@factory-sim/schema';
import type { Rng } from './api';
import { exp, log } from './math';

/**
 * A standard normal sampler (Marsaglia's polar method: needs only `log` and `sqrt`, both
 * exact here). Each accepted pair yields two values; the spare is kept for the next call.
 */
function standardNormal(rng: Rng): () => number {
  let spare = 0;
  let hasSpare = false;
  return () => {
    if (hasSpare) {
      hasSpare = false;
      return spare;
    }
    let u: number;
    let v: number;
    let s: number;
    do {
      u = 2 * rng.next() - 1;
      v = 2 * rng.next() - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const f = Math.sqrt((-2 * log(s)) / s);
    spare = v * f;
    hasSpare = true;
    return u * f;
  };
}

/**
 * A sampler for one duration on its own stream (WS-2). Every parameter is the duration's
 * own value in seconds; samples are truncated at 0 (WS-2 AC3).
 */
export function durationSampler(rng: Rng, d: Duration): () => number {
  switch (d.kind) {
    case 'fixed': {
      const value = d.value;
      return () => value;
    }
    case 'exponential':
      return () => rng.exponential(d.mean);
    case 'triangular': {
      // Inverse CDF.
      const { min, mode, max } = d;
      const range = max - min;
      const split = (mode - min) / range;
      return () => {
        const u = rng.next();
        return u < split
          ? min + Math.sqrt(u * range * (mode - min))
          : max - Math.sqrt((1 - u) * range * (max - mode));
      };
    }
    case 'normal': {
      const z = standardNormal(rng);
      return () => Math.max(0, d.mean + d.stdDev * z());
    }
    case 'lognormal': {
      // Parameters of the underlying normal from the duration's mean and std dev.
      const ratio = d.stdDev / d.mean;
      const sigma2 = log(1 + ratio * ratio);
      const mu = log(d.mean) - sigma2 / 2;
      const sigma = Math.sqrt(sigma2);
      const z = standardNormal(rng);
      return () => exp(mu + sigma * z());
    }
  }
}
