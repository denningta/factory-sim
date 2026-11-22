import { buildLoopTrack, type Track } from './tracks';

// ?x=N scales both counts to find headroom beyond the 200/500 target.
const SCALE = Number(new URLSearchParams(location.search).get('x') ?? 1) || 1;
export const EQUIPMENT_COUNT = 200 * SCALE;
export const PART_COUNT = 500 * SCALE;
const COLS = 20;
const SPACING = 5; // m
const LOOP_SECONDS = 120;

export interface Equipment {
  x: number;
  z: number;
}

export const equipment: Equipment[] = Array.from({ length: EQUIPMENT_COUNT }, (_, i) => ({
  x: (i % COLS) * SPACING - ((COLS - 1) * SPACING) / 2,
  z: Math.floor(i / COLS) * SPACING * 1.6 - 25,
}));

/** One conveyor loop per row of equipment; 10 rows -> 50 parts per loop. */
const rows = EQUIPMENT_COUNT / COLS;
export const LOOP_PERIOD = LOOP_SECONDS;
export const tracks: Track[] = Array.from({ length: PART_COUNT }, (_, i) => {
  const row = i % rows;
  const z = row * SPACING * 1.6 - 25 + 2.2;
  const half = ((COLS - 1) * SPACING) / 2 + 2;
  const path = [
    [-half, z],
    [half, z],
    [half, z + 1],
    [-half, z + 1],
  ] as const;
  const per = PART_COUNT / rows;
  const length = (half * 2 + 1) * 2;
  const offset = (Math.floor(i / rows) / per) * length;
  return buildLoopTrack(path, 1.5, offset, LOOP_SECONDS);
});
