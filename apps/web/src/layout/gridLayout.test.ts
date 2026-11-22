import { describe, expect, it } from 'vitest';
import { gridLayout, gridLinePositions, snapToGrid, MAX_GRID_LINES } from './gridLayout';

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

describe('grid line vertices', () => {
  const floor = { width: 30, length: 20, gridSpacing: 5 };
  const segments = gridLinePositions(floor).reduce<number[][]>((acc, v, i) => {
    if (i % 6 === 0) acc.push([]);
    acc[acc.length - 1]!.push(v);
    return acc;
  }, []);

  it('spans exactly [0, width] x [0, length] on the ground plane', () => {
    const xs = segments.flatMap((s) => [s[0]!, s[3]!]);
    const zs = segments.flatMap((s) => [s[2]!, s[5]!]);
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([0, 30]);
    expect([Math.min(...zs), Math.max(...zs)]).toEqual([0, 20]);
    expect(segments.every((s) => s[1] === 0 && s[4] === 0)).toBe(true);
  });
  it('has one segment per grid line, each running the full opposite extent', () => {
    expect(segments).toHaveLength(7 + 5);
    expect(segments).toContainEqual([10, 0, 0, 10, 0, 20]); // x line runs along z (length)
    expect(segments).toContainEqual([0, 0, 15, 30, 0, 15]); // y line maps to z, runs along x (width)
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
