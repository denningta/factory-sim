import type { Vec3 } from './types';

/** Least spacing of queue slots (m): a part plus a small gap. Parts are drawn 0.27 m wide. */
export const SLOT_PITCH = 0.3;
/** Lets a side of exactly n pitches hold n slots despite rounding (0.6 / 0.3 < 2 in floats). */
const FIT_EPS = 1e-9;

interface SlotArea {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
  /** Heights of the surfaces parts rest on (shelves), filled in this order. */
  levels: readonly number[];
  /** Parts past the last level's grid stack up from it, but never above this. */
  yMax: number;
}

/**
 * Queue slots on a grid over a rectangle: row by row from `z0`, then the next level, then
 * stacked on the last level. Every slot stays inside the rectangle, so a long queue piles up
 * on the equipment rather than spilling across the floor.
 */
export function gridSlots(a: SlotArea): (i: number) => Vec3 {
  const cols = Math.max(1, Math.floor((a.x1 - a.x0) / SLOT_PITCH + FIT_EPS));
  const rows = Math.max(1, Math.floor((a.z1 - a.z0) / SLOT_PITCH + FIT_EPS));
  const perLevel = cols * rows;
  const dx = (a.x1 - a.x0) / cols;
  const dz = (a.z1 - a.z0) / rows;
  return (i) => {
    const n = Math.max(0, Math.floor(i));
    const level = Math.floor(n / perLevel);
    const k = n % perLevel;
    const last = a.levels.length - 1;
    const y =
      level <= last
        ? a.levels[level]!
        : Math.min(a.levels[last]! + (level - last) * SLOT_PITCH, a.yMax);
    return [a.x0 + ((k % cols) + 0.5) * dx, y, a.z0 + (Math.floor(k / cols) + 0.5) * dz];
  };
}
