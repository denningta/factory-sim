import { describe, expect, it } from 'vitest';
import { buildLoopTrack, createCursor, positionAt } from './tracks';

const square = [
  [0, 0],
  [4, 0],
  [4, 4],
  [0, 4],
] as const;

describe('part tracks (ADR-0008 interpolation)', () => {
  it('interpolates linearly inside a segment', () => {
    const track = buildLoopTrack(square, 2, 0, 20);
    const out = { x: 0, z: 0 };
    positionAt(track, createCursor(), 1, out);
    expect(out).toEqual({ x: 2, z: 0 });
  });

  it('turns corners and honours the start offset', () => {
    const track = buildLoopTrack(square, 2, 4, 20); // starts 4 m along: at (4,0)
    const out = { x: 0, z: 0 };
    positionAt(track, createCursor(), 1, out);
    expect(out).toEqual({ x: 4, z: 2 });
  });

  it('is independent of the order and spacing of queries (cursor is only a cache)', () => {
    const track = buildLoopTrack(square, 2, 0, 20);
    const a = { x: 0, z: 0 };
    const b = { x: 0, z: 0 };
    const cur = createCursor();
    positionAt(track, cur, 7.3, a);
    positionAt(track, cur, 1.1, a); // time going backwards (loop wrap) must still work
    positionAt(track, createCursor(), 1.1, b);
    expect(a).toEqual(b);
  });

  it('covers the whole duration with continuous segments', () => {
    const track = buildLoopTrack(square, 3, 0, 30);
    expect(track.t0[0]).toBe(0);
    expect(track.t1[track.t1.length - 1]).toBeGreaterThanOrEqual(30);
    for (let i = 1; i < track.t0.length; i++) expect(track.t0[i]).toBeCloseTo(track.t1[i - 1]!);
  });
});
