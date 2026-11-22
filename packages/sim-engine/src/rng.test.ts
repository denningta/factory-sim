import { describe, expect, it } from 'vitest';
import { createRng } from './rng';

function draw(seed: number, n = 5): number[] {
  const rng = createRng(seed);
  return Array.from({ length: n }, () => rng.next());
}

describe('createRng (sfc32 seeded via splitmix32)', () => {
  it('is reproducible: same seed gives the same sequence', () => {
    expect(draw(42, 100)).toEqual(draw(42, 100));
    expect(draw(42)).not.toEqual(draw(43));
  });

  it('pins its output so an algorithm change is noticed (it shifts reference-model results)', () => {
    // Golden values: update only together with the reference-model baseline.
    expect(draw(1, 3)).toMatchInlineSnapshot(`
      [
        0.42564993195549927,
        0.6910148153015395,
        0.9659408922812848,
      ]
    `);
    expect(createRng(0).exponential(1)).toMatchInlineSnapshot(`3.8701735346791866`);
  });

  it('normalizes the seed with >>> 0 and rejects non-integers', () => {
    expect(draw(-1)).toEqual(draw(0xffffffff));
    expect(draw(2 ** 32 + 7)).toEqual(draw(7));
    expect(() => createRng(1.5)).toThrow();
    expect(() => createRng(NaN)).toThrow();
  });

  it('next() is uniform in [0, 1)', () => {
    const rng = createRng(7);
    let sum = 0;
    const n = 100_000;
    for (let i = 0; i < n; i++) {
      const u = rng.next();
      expect(u >= 0 && u < 1).toBe(true);
      sum += u;
    }
    expect(sum / n).toBeCloseTo(0.5, 2);
  });

  it('uniform(min, max) and integer(min, max) stay in range', () => {
    const rng = createRng(3);
    const seen = new Set<number>();
    for (let i = 0; i < 10_000; i++) {
      const u = rng.uniform(-2, 3);
      expect(u >= -2 && u < 3).toBe(true);
      const k = rng.integer(5, 9);
      expect(Number.isInteger(k) && k >= 5 && k < 9).toBe(true);
      seen.add(k);
    }
    expect([...seen].sort()).toEqual([5, 6, 7, 8]);
    expect(() => rng.uniform(1, 1)).not.toThrow();
    expect(() => rng.uniform(2, 1)).toThrow();
    expect(() => rng.integer(1, 1)).toThrow();
    expect(() => rng.integer(0.5, 3)).toThrow();
  });

  it('uniform(min, max) never returns max, even when rounding would land on it', () => {
    const rng = createRng(1);
    const min = 2 ** 53; // spacing 2 here, so min + u·2 rounds to max for u > 0.5
    const max = min + 2;
    let atMax = 0;
    for (let i = 0; i < 1000; i++) {
      const x = rng.uniform(min, max);
      expect(x >= min && x < max).toBe(true);
      if (x === min + 1) atMax++; // nextDown(max) at this magnitude
    }
    expect(atMax).toBeGreaterThan(0); // the clamp actually ran
  });

  it('exponential(mean) has the requested mean and rejects a non-positive mean', () => {
    const rng = createRng(11);
    let sum = 0;
    const n = 200_000;
    for (let i = 0; i < n; i++) {
      const x = rng.exponential(2.5);
      expect(x >= 0 && Number.isFinite(x)).toBe(true);
      sum += x;
    }
    expect(sum / n).toBeCloseTo(2.5, 1);
    expect(() => rng.exponential(0)).toThrow();
    expect(() => rng.exponential(-1)).toThrow();
    expect(() => rng.exponential(Infinity)).toThrow();
  });

  it('fork(label) is deterministic, label-specific and independent of draws on the parent', () => {
    const a = createRng(9);
    const b = createRng(9);
    for (let i = 0; i < 50; i++) b.next();
    const fa = a.fork('station-1');
    const fb = b.fork('station-1');
    const seqA = [fa.next(), fa.next(), fa.next()];
    expect([fb.next(), fb.next(), fb.next()]).toEqual(seqA);
    expect(a.fork('station-2').next()).not.toBe(seqA[0]);
    expect(createRng(10).fork('station-1').next()).not.toBe(seqA[0]);
    expect(a.fork('station-1').fork('x').next()).toBe(b.fork('station-1').fork('x').next());
  });
});
