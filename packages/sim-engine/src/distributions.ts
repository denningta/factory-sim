import type { Duration } from '@factory-sim/schema';
import type { Rng } from './api';

/** A sampler for one duration on its own stream (WS-2). Stub until SE-6 lands. */
export function durationSampler(_rng: Rng, _d: Duration): () => number {
  throw new Error('Not implemented yet (SE-6)');
}
