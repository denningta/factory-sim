// Stand-in for the engine's timestamped movement events (ADR-0008): each part has
// consecutive segments {t0,t1,from,to}; the renderer interpolates on its own clock.
export interface Track {
  t0: Float32Array;
  t1: Float32Array;
  x0: Float32Array;
  z0: Float32Array;
  x1: Float32Array;
  z1: Float32Array;
}
export interface Cursor {
  i: number;
}
export const createCursor = (): Cursor => ({ i: 0 });

/** A part circulating a closed polyline at constant speed, as sim events up to `duration`. */
export function buildLoopTrack(
  path: ReadonlyArray<readonly [number, number]>,
  speed: number,
  startOffset: number,
  duration: number,
): Track {
  const n = path.length;
  const lens = path.map((p, i) => {
    const q = path[(i + 1) % n]!;
    return Math.hypot(q[0] - p[0], q[1] - p[1]);
  });
  const total = lens.reduce((a, b) => a + b, 0);
  // find starting edge and the remainder along it
  let edge = 0;
  let along = ((startOffset % total) + total) % total;
  while (along >= lens[edge]!) {
    along -= lens[edge]!;
    edge = (edge + 1) % n;
  }
  const rows: number[][] = [];
  let t = 0;
  let first = true;
  while (t < duration) {
    const p = path[edge]!;
    const q = path[(edge + 1) % n]!;
    const len = lens[edge]!;
    const f0 = first ? along / len : 0;
    const dt = (len * (1 - f0)) / speed;
    rows.push([t, t + dt, p[0] + (q[0] - p[0]) * f0, p[1] + (q[1] - p[1]) * f0, q[0], q[1]]);
    t += dt;
    edge = (edge + 1) % n;
    first = false;
  }
  const col = (k: number) => Float32Array.from(rows.map((r) => r[k]!));
  return { t0: col(0), t1: col(1), x0: col(2), z0: col(3), x1: col(4), z1: col(5) };
}

/** Amortised O(1) when time moves forward; the cursor is only a cache, never state. */
export function positionAt(
  track: Track,
  cursor: Cursor,
  t: number,
  out: { x: number; z: number },
): void {
  let i = cursor.i;
  const last = track.t0.length - 1;
  if (t < track.t0[i]!) i = 0;
  while (i < last && t >= track.t1[i]!) i++;
  cursor.i = i;
  const a = track.t0[i]!;
  const f = Math.min(1, Math.max(0, (t - a) / (track.t1[i]! - a)));
  out.x = track.x0[i]! + (track.x1[i]! - track.x0[i]!) * f;
  out.z = track.z0[i]! + (track.z1[i]! - track.z0[i]!) * f;
}
