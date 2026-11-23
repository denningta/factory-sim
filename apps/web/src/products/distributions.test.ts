import { describe, expect, it } from 'vitest';
import { createRng } from '@factory-sim/sim-engine';
import { durationSchema, type Duration } from '@factory-sim/schema';
import { previewHistogram, sampleDuration } from './distributions';

const draw = (d: Duration, n = 20000) => {
  const rng = createRng(7);
  return Array.from({ length: n }, () => sampleDuration(d, rng));
};
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
const sd = (xs: number[]) => {
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

describe('WS-2 supported distributions: fixed, normal, triangular, lognormal, exponential', () => {
  it('fixed always returns its value', () => {
    expect(new Set(draw({ kind: 'fixed', value: 30 }, 50))).toEqual(new Set([30]));
  });
  it('normal matches its mean and std dev', () => {
    const xs = draw({ kind: 'normal', mean: 60, stdDev: 5 });
    expect(mean(xs)).toBeCloseTo(60, 0);
    expect(sd(xs)).toBeCloseTo(5, 0);
  });
  it('triangular stays in [min,max] with mean (min+mode+max)/3', () => {
    const xs = draw({ kind: 'triangular', min: 10, mode: 20, max: 60 });
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(10);
    expect(Math.max(...xs)).toBeLessThanOrEqual(60);
    expect(mean(xs)).toBeCloseTo(30, 0);
  });
  it('lognormal matches the mean and std dev of the duration itself', () => {
    const xs = draw({ kind: 'lognormal', mean: 40, stdDev: 10 });
    expect(mean(xs)).toBeCloseTo(40, 0);
    expect(sd(xs)).toBeCloseTo(10, 0);
  });
  it('exponential matches its mean', () => {
    expect(mean(draw({ kind: 'exponential', mean: 25 }))).toBeCloseTo(25, 0);
  });
  it('is deterministic for the same seed', () => {
    const d: Duration = { kind: 'normal', mean: 5, stdDev: 2 };
    expect(draw(d, 20)).toEqual(draw(d, 20));
  });
});

describe('WS-2 negative samples are prevented (truncated)', () => {
  it('a normal with mean ≈ 0 never yields a negative sample', () => {
    const xs = draw({ kind: 'normal', mean: 1, stdDev: 10 });
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
  });
  it('the schema rejects negative parameters', () => {
    expect(durationSchema.safeParse({ kind: 'normal', mean: -1, stdDev: 1 }).success).toBe(false);
  });
  it('the histogram has no bin below zero', () => {
    const h = previewHistogram({ kind: 'normal', mean: 1, stdDev: 10 });
    expect(h.bins[0]!.from).toBeGreaterThanOrEqual(0);
  });
});

describe('WS-2 a small histogram previews the distribution', () => {
  it('counts every sample, in equal-width bins', () => {
    const h = previewHistogram(
      { kind: 'normal', mean: 60, stdDev: 5 },
      { samples: 1000, bins: 12 },
    );
    expect(h.bins).toHaveLength(12);
    expect(h.bins.reduce((a, b) => a + b.count, 0)).toBe(1000);
  });
  it('is stable between calls (seeded)', () => {
    const d: Duration = { kind: 'exponential', mean: 10 };
    expect(previewHistogram(d)).toEqual(previewHistogram(d));
  });
  it('a fixed value lands in a single bin', () => {
    const h = previewHistogram({ kind: 'fixed', value: 30 });
    expect(h.bins.filter((b) => b.count > 0)).toHaveLength(1);
  });
});
