import type { Demand } from '@factory-sim/schema';

/**
 * Values for `ids` that add up to exactly `total` (100 for a mix): `weights` scaled to fit,
 * or an even split when they're all zero. Largest-remainder rounding to 0.01 keeps the sum
 * exact and every value non-negative (a schema rule), so a zero weight stays 0.
 */
export function toMix(ids: string[], weights: Map<string, number>, total = 100): Demand['items'] {
  if (ids.length === 0) return [];
  const sum = ids.reduce((t, id) => t + (weights.get(id) ?? 0), 0);
  const cents = Math.round(total * 100);
  const exact = ids.map((id) =>
    sum > 0 ? ((weights.get(id) ?? 0) / sum) * cents : cents / ids.length,
  );
  const floors = exact.map(Math.floor);
  let left = cents - floors.reduce((t, n) => t + n, 0);
  const order = exact
    .map((x, i) => i)
    .sort((i, j) => exact[j]! - floors[j]! - (exact[i]! - floors[i]!));
  for (const i of order) {
    if (left <= 0) break;
    floors[i]!++;
    left--;
  }
  return ids.map((productId, i) => ({ productId, value: floors[i]! / 100 }));
}

/** One part every shift ÷ units interval, or null when nothing is demanded. */
export function intervalForShift(shiftLength: number, units: number): number | null {
  return units > 0 ? shiftLength / units : null;
}
