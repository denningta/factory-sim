import type { StationState } from '@factory-sim/sim-engine';
import { stateLabel } from './stationStatus';

export interface CalloutInput {
  name: string;
  state: StationState | undefined;
  waiting: number;
  working: number;
  bottleneck: boolean;
}

export const calloutLines = (c: CalloutInput) => ({
  title: c.name,
  state: `● ${c.state ? stateLabel(c.state) : 'Not started'}`,
  stats: `${c.waiting} waiting · ${Math.round(c.working)}% working`,
  ...(c.bottleneck ? { badge: 'Bottleneck' } : {}),
});

/** Card text is never smaller than this on screen (product owner). */
export const MIN_TEXT_PX = 12;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Cards are placed at their station's screen position; any that would overlap an earlier one
 * (left to right) are lifted up the screen until they clear. Returns the lift in px (≥ 0) per rect.
 */
export function resolveOverlaps(rects: readonly Rect[], gap = 6): number[] {
  const lifts = new Array<number>(rects.length).fill(0);
  const order = rects.map((_, i) => i).sort((a, b) => rects[a]!.x - rects[b]!.x || a - b);
  const placed: Rect[] = [];
  for (const i of order) {
    const r = rects[i]!;
    let y = r.y;
    for (let moved = true; moved;) {
      moved = false;
      for (const p of placed) {
        const sideBySide = r.x + r.w + gap <= p.x || p.x + p.w + gap <= r.x;
        if (!sideBySide && y < p.y + p.h + gap && p.y < y + r.h + gap) {
          y = p.y - r.h - gap;
          moved = true;
        }
      }
    }
    lifts[i] = r.y - y;
    placed.push({ ...r, y });
  }
  return lifts;
}

/** Pixels per world meter at `depth` from the camera, to size cards in pixels. */
export const pixelsPerMeter = (
  cam: { kind: 'ortho'; zoom: number } | { kind: 'persp'; fovDeg: number },
  viewportH: number,
  depth: number,
): number =>
  cam.kind === 'ortho'
    ? cam.zoom
    : viewportH / (2 * depth * Math.tan((cam.fovDeg / 2) * (Math.PI / 180)));

/** Look of the connection leaving `from`: blocked colour with no flow, else accent with flow while playing. */
export const connectionLook = (
  from: StationState | undefined,
  playing: boolean,
): { kind: 'flow' | 'blocked'; flowing: boolean } =>
  from === 'blocked' ? { kind: 'blocked', flowing: false } : { kind: 'flow', flowing: playing };
