import { describe, expect, it } from 'vitest';
import { log } from './math';

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
