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

/** Half-size (px) of the box around a station's screen point that no card may cover. */
export const ANCHOR_BOX = 22;

/**
 * Screen position (top-left, px) of each card, given its station's screen point. Each card tries
 * above its station, then to the right, then to the left, then above but lifted tier by tier,
 * then beside it lower down; the first spot inside the viewport that covers no station box and
 * no card already placed wins. Stations stacked on screen (a line along the view's depth axis)
 * end up with cards alternating sides instead of covering their neighbours or piling off the
 * top edge. `fallback` marks a card for which no free spot existed: it is clamped into the
 * viewport and may overlap.
 */
export function placeCards(
  anchors: readonly { x: number; y: number }[],
  size: { w: number; h: number },
  viewport: { w: number; h: number },
  leader = 36,
  gap = 6,
): { x: number; y: number; fallback: boolean }[] {
  const { w, h } = size;
  const out = new Array<{ x: number; y: number; fallback: boolean }>(anchors.length);
  const boxes: Rect[] = anchors.map((a) => ({
    x: a.x - ANCHOR_BOX,
    y: a.y - ANCHOR_BOX,
    w: ANCHOR_BOX * 2,
    h: ANCHOR_BOX * 2,
  }));
  const placed: Rect[] = [];
  const margin = 4;
  const inside = (r: Rect) =>
    r.x >= margin &&
    r.y >= margin &&
    r.x + r.w <= viewport.w - margin &&
    r.y + r.h <= viewport.h - margin;
  const apart = (r: Rect, p: Rect, g: number) =>
    r.x + r.w + g <= p.x || p.x + p.w + g <= r.x || r.y + r.h + g <= p.y || p.y + p.h + g <= r.y;
  const clear = (r: Rect) =>
    placed.every((p) => apart(r, p, gap)) && boxes.every((b) => apart(r, b, 0));
  // Farther stations (top of the screen) first, so the stations nearer the viewer, whose cards
  // have more room below and beside, take what is left.
  const order = anchors.map((_, i) => i).sort((a, b) => anchors[a]!.y - anchors[b]!.y || a - b);
  for (const i of order) {
    const a = anchors[i]!;
    const above = { x: a.x - w / 2, y: a.y - leader - h };
    const sideY = a.y - h / 2 - 10;
    const right = a.x + ANCHOR_BOX + 8;
    const left = a.x - ANCHOR_BOX - 8 - w;
    const tiers = [1, 2, 3, 4];
    const candidates = [
      above,
      { x: right, y: sideY },
      { x: left, y: sideY },
      ...tiers.map((k) => ({ x: above.x, y: above.y - k * (h + gap) })),
      ...tiers.map((k) => ({ x: right, y: sideY - k * (h + gap) })),
      ...tiers.map((k) => ({ x: right, y: sideY + k * (h + gap) })),
      ...tiers.map((k) => ({ x: left, y: sideY - k * (h + gap) })),
      ...tiers.map((k) => ({ x: left, y: sideY + k * (h + gap) })),
    ];
    const free = candidates.find((c) => inside({ ...c, w, h }) && clear({ ...c, w, h }));
    const pick = free ?? {
      x: Math.min(Math.max(above.x, margin), viewport.w - w - margin),
      y: Math.min(Math.max(above.y, margin), viewport.h - h - margin),
    };
    out[i] = { ...pick, fallback: !free };
    placed.push({ ...pick, w, h });
  }
  return out;
}

/** Most cards drawn at once: every card is a sprite and a line, so they dominate draw calls. */
export const MAX_CALLOUTS = 8;

/**
 * Which stations get a card: the `limit` nearest the camera, then the bottleneck if it isn't
 * among them. Beyond a handful the cards overlap into noise anyway.
 */
export function pickCalloutStations(
  _stations: readonly { id: string; x: number; y: number; z: number }[],
  _camera: { x: number; y: number; z: number },
  _bottleneckId: string | null,
  _limit: number,
): string[] {
  throw new Error('not implemented');
}
