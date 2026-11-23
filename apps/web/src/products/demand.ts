import type { Demand } from '@factory-sim/schema';

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Values for `ids` that add up to exactly `total` (100 for a mix): `weights` scaled to fit,
 * or an even split when they're all zero. The last id absorbs rounding so the schema's sum
 * rule holds.
 */
export function toMix(ids: string[], weights: Map<string, number>, total = 100): Demand['items'] {
  if (ids.length === 0) return [];
  const sum = ids.reduce((t, id) => t + (weights.get(id) ?? 0), 0);
  let used = 0;
  return ids.map((productId, i) => {
    const share = sum > 0 ? ((weights.get(productId) ?? 0) / sum) * total : total / ids.length;
    const value = i === ids.length - 1 ? round2(total - used) : round2(share);
    used += value;
    return { productId, value };
  });
}

/** One part every shift ÷ units interval, or null when nothing is demanded. */
export function intervalForShift(shiftLength: number, units: number): number | null {
  return units > 0 ? shiftLength / units : null;
}
