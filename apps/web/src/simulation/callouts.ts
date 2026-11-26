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

/**
 * Screen position (top-left, px) of each card, given its station's screen point. Each card tries
 * above its station, then to the right, then to the left, then above but lifted tier by tier;
 * the first spot inside the viewport that clears the cards already placed wins. Lines that run
 * along the view's depth axis (stations stacked on screen) end up with cards alternating sides
 * instead of piling off the top edge.
 */
export function placeCards(
  anchors: readonly { x: number; y: number }[],
  size: { w: number; h: number },
  viewport: { w: number; h: number },
  leader = 36,
  gap = 6,
): { x: number; y: number }[] {
  const { w, h } = size;
  const out = new Array<{ x: number; y: number }>(anchors.length);
  const placed: Rect[] = [];
  const margin = 4;
  const inside = (r: Rect) =>
    r.x >= margin &&
    r.y >= margin &&
    r.x + r.w <= viewport.w - margin &&
    r.y + r.h <= viewport.h - margin;
  const clear = (r: Rect) =>
    placed.every(
      (p) =>
        r.x + r.w + gap <= p.x ||
        p.x + p.w + gap <= r.x ||
        r.y + r.h + gap <= p.y ||
        p.y + p.h + gap <= r.y,
    );
  // Back-to-front (top of the screen first) so nearer stations keep the nicer spots.
  const order = anchors.map((_, i) => i).sort((a, b) => anchors[a]!.y - anchors[b]!.y || a - b);
  for (const i of order) {
    const a = anchors[i]!;
    const above = { x: a.x - w / 2, y: a.y - leader - h };
    const side = a.y - h / 2 - 10;
    const candidates = [
      above,
      { x: a.x + 28, y: side },
      { x: a.x - 28 - w, y: side },
      ...[1, 2, 3, 4].map((k) => ({ x: above.x, y: above.y - k * (h + gap) })),
      ...[1, 2].map((k) => ({ x: a.x + 28, y: side + k * (h + gap) })),
      ...[1, 2].map((k) => ({ x: a.x - 28 - w, y: side + k * (h + gap) })),
    ];
    const pick =
      candidates.find((c) => inside({ ...c, w, h }) && clear({ ...c, w, h })) ?? candidates[0]!;
    out[i] = pick;
    placed.push({ ...pick, w, h });
  }
  return out;
}
