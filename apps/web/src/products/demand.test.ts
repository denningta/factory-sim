import { describe, expect, it } from 'vitest';
import { toMix } from './demand';

describe('toMix (review probe)', () => {
  it('never returns a negative value and keeps the total exact', () => {
    const w = new Map([
      ['a', 1],
      ['b', 1],
      ['c', 1],
      ['d', 0],
    ]);
    const items = toMix(['a', 'b', 'c', 'd'], w, 100.01);
    expect(items.every((i) => i.value >= 0)).toBe(true);
    expect(items.find((i) => i.productId === 'd')!.value).toBe(0);
    expect(Math.round(items.reduce((t, i) => t + i.value, 0) * 100)).toBe(10001);
  });
  it('splits evenly with all-zero weights', () => {
    expect(toMix(['a', 'b', 'c'], new Map()).map((i) => i.value)).toEqual([33.34, 33.33, 33.33]);
  });
});
