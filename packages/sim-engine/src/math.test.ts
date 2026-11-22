import { describe, expect, it } from 'vitest';
import { log, nextDown } from './math';

const f64 = new Float64Array(1);
const i64 = new BigInt64Array(f64.buffer);
function bits(x: number): bigint {
  f64[0] = x;
  return i64[0]!;
}
function ulpDistance(a: number, b: number): number {
  return Number(bits(a) > bits(b) ? bits(a) - bits(b) : bits(b) - bits(a));
}

describe('log (exact-operation port of fdlibm __ieee754_log)', () => {
  it('is within 1 ulp of Math.log over a sample of inputs', () => {
    const inputs: number[] = [
      1,
      2,
      0.5,
      10,
      1e-300,
      1e300,
      Number.MAX_VALUE,
      Number.MIN_VALUE,
      5e-324,
    ];
    inputs.push(1 + 2 ** -30, 1 - 2 ** -30, 1 + 2 ** -52, 1 - 2 ** -53, 2.2250738585072014e-308);
    // Deterministic sweep: uniforms in (0, 1] (the exponential sampler's domain) and wide magnitudes.
    let s = 12345;
    for (let i = 0; i < 20000; i++) {
      s = (Math.imul(s, 1103515245) + 12345) >>> 0;
      inputs.push(1 - s / 4294967296);
      inputs.push((s / 4294967296 + 1e-9) * 2 ** ((i % 2000) - 1000));
    }
    let worst = 0;
    for (const x of inputs) worst = Math.max(worst, ulpDistance(log(x), Math.log(x)));
    expect(worst).toBeLessThanOrEqual(1);
  });

  it('handles the special values like Math.log', () => {
    expect(log(0)).toBe(-Infinity);
    expect(log(-0)).toBe(-Infinity);
    expect(log(-1)).toBeNaN();
    expect(log(NaN)).toBeNaN();
    expect(log(Infinity)).toBe(Infinity);
    expect(log(1)).toBe(0);
    expect(log(Math.E)).toBeCloseTo(1, 15);
  });
});

describe('log output is pinned bit for bit', () => {
  it('returns these golden values (a change shifts every exponential sample)', () => {
    // Shortest round-trip decimals identify each double exactly. Covers every branch:
    // |f| < 2^-20 with k = 0 and k ≠ 0, both polynomial branches, subnormal scaling.
    const inputs = [
      0.1,
      0.5,
      0.75,
      1 + 2 ** -25,
      2 * (1 + 2 ** -25),
      4,
      1.3,
      1.9,
      7,
      123456.789,
      1e-310,
    ];
    expect(inputs.map(log)).toMatchInlineSnapshot(`
      [
        -2.3025850929940455,
        -0.6931471805599453,
        -0.2876820724517809,
        2.9802321943606113e-8,
        0.6931472103622672,
        1.3862943611198906,
        0.26236426446749106,
        0.6418538861723947,
        1.9459101490553132,
        11.723646487185881,
        -713.8013788281542,
      ]
    `);
  });
});

describe('nextDown', () => {
  it('returns the adjacent smaller double', () => {
    for (const x of [
      1,
      0.75,
      2 ** 53 + 2,
      -1,
      -0.5,
      Number.MIN_VALUE,
      -Number.MAX_VALUE / 2,
      3e-310,
    ]) {
      const d = nextDown(x);
      expect(d).toBeLessThan(x);
      const mid = d / 2 + x / 2; // halves first: d + x overflows near MAX_VALUE
      expect(mid === d || mid === x).toBe(true); // nothing in between
    }
    expect(nextDown(0)).toBe(-Number.MIN_VALUE);
    expect(nextDown(1)).toBe(1 - 2 ** -53);
    expect(nextDown(-1)).toBe(-1 - 2 ** -52);
    expect(nextDown(2 ** 32)).toBe(2 ** 32 - 2 ** -21); // low word borrows from the high word
    expect(nextDown(-(2 ** 32 - 2 ** -21))).toBe(-(2 ** 32)); // low word carries into the high word
  });
});
