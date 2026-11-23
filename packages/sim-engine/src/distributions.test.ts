import { describe, expect, it } from 'vitest';
import type { Duration } from '@factory-sim/schema';
import { durationSampler } from './distributions';
import { exp, sinCos } from './math';
import { createRng } from './rng';

function stats(d: Duration, n = 40_000) {
  const sample = durationSampler(createRng(5), d);
  let sum = 0;
  let sq = 0;
  let min = Infinity;
  for (let i = 0; i < n; i++) {
    const x = sample();
    sum += x;
    sq += x * x;
    min = Math.min(min, x);
  }
  const mean = sum / n;
  return { mean, sd: Math.sqrt(sq / n - mean * mean), min };
}

describe('durationSampler (WS-2 kinds, truncated at 0)', () => {
  it('fixed is exact', () => {
    expect(stats({ kind: 'fixed', value: 12.5 }, 10)).toEqual({ mean: 12.5, sd: 0, min: 12.5 });
  });

  it.each<[Duration, number, number]>([
    [{ kind: 'exponential', mean: 20 }, 20, 20],
    [{ kind: 'normal', mean: 30, stdDev: 3 }, 30, 3],
    [
      { kind: 'triangular', min: 10, mode: 20, max: 60 },
      30,
      Math.sqrt((100 + 400 + 3600 - 200 - 600 - 1200) / 18),
    ],
    [{ kind: 'lognormal', mean: 40, stdDev: 10 }, 40, 10],
  ])('%j has the right mean and spread', (d, mean, sd) => {
    const s = stats(d);
    expect(s.mean).toBeCloseTo(mean, 0);
    expect(Math.abs(s.sd - sd) / sd).toBeLessThan(0.03);
    expect(s.min).toBeGreaterThanOrEqual(0);
  });

  it('never returns a negative duration', () => {
    expect(stats({ kind: 'normal', mean: 1, stdDev: 5 }).min).toBe(0);
  });

  it('is reproducible per stream', () => {
    const d: Duration = { kind: 'lognormal', mean: 40, stdDev: 10 };
    const a = durationSampler(createRng(9), d);
    const b = durationSampler(createRng(9), d);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe('exact math', () => {
  it('exp matches Math.exp to within an ulp or so', () => {
    for (let x = -700; x < 709; x += 0.37) {
      const want = Math.exp(x);
      expect(Math.abs(exp(x) - want) / want).toBeLessThan(4e-16);
    }
    for (const x of [0, 1e-10, -1e-10, 0.3, -0.3, 0.6, -0.6, 1, -1]) {
      expect(Math.abs(exp(x) - Math.exp(x)) / Math.exp(x)).toBeLessThan(4e-16);
    }
    expect(exp(0)).toBe(1);
    expect(exp(710)).toBe(Infinity);
    expect(exp(-746)).toBe(0);
    expect(exp(-740)).toBeGreaterThan(0); // subnormal result
    expect(exp(-Infinity)).toBe(0);
    expect(exp(NaN)).toBeNaN();
  });

  it('sinCos matches Math.sin/cos', () => {
    for (let x = -20; x < 20; x += 0.0137) {
      const [s, c] = sinCos(x);
      expect(Math.abs(s - Math.sin(x))).toBeLessThan(1e-15);
      expect(Math.abs(c - Math.cos(x))).toBeLessThan(1e-15);
    }
    expect(sinCos(0)).toEqual([0, 1]);
  });
});
