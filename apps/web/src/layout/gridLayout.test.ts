import { describe, expect, it } from 'vitest';
import { gridLayout, snapToGrid, MAX_GRID_LINES } from './gridLayout';

describe('grid drawn to scale with labeled dimensions (LE-1)', () => {
  const floor = { width: 30, length: 20, gridSpacing: 5 };
  it('places lines at every spacing in meters, including both floor edges', () => {
    const g = gridLayout(floor);
    expect(g.xs).toEqual([0, 5, 10, 15, 20, 25, 30]);
    expect(g.ys).toEqual([0, 5, 10, 15, 20]);
  });
  it('always closes the floor outline when spacing does not divide evenly', () => {
    const g = gridLayout({ width: 12, length: 4, gridSpacing: 5 });
    expect(g.xs).toEqual([0, 5, 10, 12]);
    expect(g.ys).toEqual([0, 4]);
  });
  it('adjustable spacing changes the line count', () => {
    expect(gridLayout({ ...floor, gridSpacing: 10 }).xs).toHaveLength(4);
  });
  it('caps line count so tiny spacing cannot hang the renderer', () => {
    const g = gridLayout({ width: 1000, length: 1000, gridSpacing: 0.001 });
    expect(g.xs.length).toBeLessThanOrEqual(MAX_GRID_LINES + 1);
  });
});

describe('snap-to-grid (LE-1)', () => {
  it('snaps to the nearest grid intersection when enabled', () => {
    expect(snapToGrid({ x: 6.4, y: 2.6 }, 5, true)).toEqual({ x: 5, y: 5 });
  });
  it('passes the point through when disabled', () => {
    expect(snapToGrid({ x: 6.4, y: 2.6 }, 5, false)).toEqual({ x: 6.4, y: 2.6 });
  });
});
