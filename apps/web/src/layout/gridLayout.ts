import type { Floor } from '@factory-sim/schema';
import type * as THREE from 'three';

/** Guards the renderer against absurd line counts; the UI rejects such spacings too. */
export const MAX_GRID_LINES = 500;

export interface GridLayout {
  /** Positions in meters of the lines that run along the floor's length (varying x). */
  xs: number[];
  /** Positions in meters of the lines that run along the floor's width (varying y). */
  ys: number[];
}

function ticks(extent: number, spacing: number): number[] {
  const step = Math.max(spacing, extent / MAX_GRID_LINES);
  const out: number[] = [];
  for (let i = 0; i * step < extent - 1e-9; i++) out.push(i * step);
  out.push(extent);
  return out;
}

export function gridLayout(floor: Floor): GridLayout {
  return { xs: ticks(floor.width, floor.gridSpacing), ys: ticks(floor.length, floor.gridSpacing) };
}

/**
 * Line-segment vertices (x, y, z triples, two per line) in meters for three's ground plane:
 * floor-plan (x, y) maps to (x, z) and y is up.
 */
export function gridLinePositions(floor: Floor): number[] {
  const { xs, ys } = gridLayout(floor);
  const pts: number[] = [];
  for (const x of xs) pts.push(x, 0, 0, x, 0, floor.length);
  for (const y of ys) pts.push(0, 0, y, floor.width, 0, y);
  return pts;
}

export function snapToGrid(
  p: { x: number; y: number },
  spacing: number,
  enabled: boolean,
): { x: number; y: number } {
  if (!enabled) return p;
  return { x: Math.round(p.x / spacing) * spacing, y: Math.round(p.y / spacing) * spacing };
}

/** Grid lines as a fresh geometry whose bounding sphere covers the whole floor. */
export function buildGridGeometry(_floor: Floor): THREE.BufferGeometry {
  throw new Error('not implemented');
}
