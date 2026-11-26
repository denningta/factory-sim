import { describe, expect, it } from 'vitest';
import { dark } from '../ui/tokens';
import { lightSegments, stateLabel } from './stationStatus';
import {
  MIN_TEXT_PX,
  calloutLines,
  connectionLook,
  pixelsPerMeter,
  placeCards,
  resolveOverlaps,
} from './callouts';
import { fitOrtho } from '../layout/cameraFit';

describe('UI-5 AC1: stack light lights one segment in the strong state colour', () => {
  it('lights only the segment of the state, in the strong colour', () => {
    const segs = lightSegments('blocked', dark);
    expect(segs.filter((s) => s.lit).map((s) => [s.segment, s.color])).toEqual([
      ['blocked', dark.state.blocked.strong],
    ]);
    expect(segs).toHaveLength(4);
  });
  it('maps the engine idle state to the waiting segment', () => {
    expect(lightSegments('idle', dark).find((s) => s.lit)?.segment).toBe('waiting');
  });
  it('lights nothing before the engine reports a state', () => {
    expect(lightSegments(undefined, dark).some((s) => s.lit)).toBe(false);
  });
});

describe('UI-5 AC2: callout card text', () => {
  it('shows name, ● state, N waiting and working %', () => {
    expect(
      calloutLines({
        name: 'Mill',
        state: 'working',
        waiting: 3,
        working: 71.4,
        bottleneck: false,
      }),
    ).toEqual({ title: 'Mill', state: '● Working', stats: '3 waiting · 71% working' });
  });
  it('adds a Bottleneck badge for the bottleneck', () => {
    expect(
      calloutLines({ name: 'Mill', state: 'idle', waiting: 0, working: 90, bottleneck: true }),
    ).toMatchObject({ state: '● Waiting for tech', badge: 'Bottleneck' });
  });
  it('text is at least 12 px tall at Zoom to fit (ortho and perspective)', () => {
    expect(MIN_TEXT_PX).toBeGreaterThanOrEqual(12);
    const fit = fitOrtho({ width: 40, length: 12, viewport: { width: 1280, height: 800 } });
    const ppm = pixelsPerMeter({ kind: 'ortho', zoom: fit.zoom }, 800, 30);
    expect(ppm).toBeCloseTo(fit.zoom);
    expect(pixelsPerMeter({ kind: 'persp', fovDeg: 45 }, 800, 20)).toBeCloseTo(
      800 / (2 * 20 * Math.tan((45 / 2) * (Math.PI / 180))),
    );
  });
  it('overlapping cards are lifted apart; separate ones stay put', () => {
    const rects = [
      { x: 0, y: 100, w: 100, h: 40 },
      { x: 50, y: 100, w: 100, h: 40 },
      { x: 400, y: 100, w: 100, h: 40 },
    ];
    const lift = resolveOverlaps(rects, 4);
    const placed = rects.map((r, i) => ({ ...r, y: r.y - lift[i]! }));
    for (let i = 0; i < 3; i++)
      for (let j = i + 1; j < 3; j++) {
        const a = placed[i]!;
        const b = placed[j]!;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap).toBe(false);
      }
    expect(lift[2]).toBe(0);
  });
});

describe('UI-5 AC4: connections', () => {
  it('flow moves only while playing; a blocked upstream draws blocked and still', () => {
    expect(connectionLook('working', true)).toEqual({ kind: 'flow', flowing: true });
    expect(connectionLook('working', false)).toEqual({ kind: 'flow', flowing: false });
    expect(connectionLook('blocked', true)).toEqual({ kind: 'blocked', flowing: false });
  });
});

describe('UI-5 AC7: idle is "Waiting for tech"', () => {
  it('labels every station state', () => {
    expect(stateLabel('idle')).toBe('Waiting for tech');
    expect(stateLabel('working')).toBe('Working');
    expect(stateLabel('starved')).toBe('Starved');
    expect(stateLabel('blocked')).toBe('Blocked');
  });
});

describe('UI-5 AC2: cards on a line that runs along the depth axis', () => {
  it('five stations stacked on screen get non-overlapping cards inside the viewport', () => {
    // The reference line seen from the front: stations in a column, 70 px apart.
    const anchors = [0, 1, 2, 3, 4].map((i) => ({ x: 400, y: 200 + i * 70 }));
    const size = { w: 176, h: 62 };
    const viewport = { w: 980, h: 800 };
    const spots = placeCards(anchors, size, viewport);
    const rects = spots.map((s) => ({ ...s, ...size }));
    for (const r of rects) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.x + r.w).toBeLessThanOrEqual(viewport.w);
      expect(r.y + r.h).toBeLessThanOrEqual(viewport.h);
    }
    for (let i = 0; i < 5; i++)
      for (let j = i + 1; j < 5; j++) {
        const a = rects[i]!;
        const b = rects[j]!;
        const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
        expect(overlap).toBe(false);
      }
  });
});
