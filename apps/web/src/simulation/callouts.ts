import type { StationState } from '@factory-sim/sim-engine';

export interface CalloutInput {
  name: string;
  state: StationState | undefined;
  waiting: number;
  working: number;
  bottleneck: boolean;
}
export const calloutLines = (
  _c: CalloutInput,
): { title: string; state: string; stats: string; badge?: string } => {
  throw new Error('not implemented');
};

/** Card text is never smaller than this on screen (product owner). */
export const MIN_TEXT_PX = 12;
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
/** Moves rects up (smaller y) until none overlap; returns the extra lift in px per rect. */
export const resolveOverlaps = (_rects: readonly Rect[], _gap?: number): number[] => {
  throw new Error('not implemented');
};
/** Pixels per world meter at `depth` for the camera, to size cards in pixels. */
export const pixelsPerMeter = (
  _cam: { kind: 'ortho'; zoom: number } | { kind: 'persp'; fovDeg: number },
  _viewportH: number,
  _depth: number,
): number => {
  throw new Error('not implemented');
};

/** Look of the connection leaving `from`: blocked colour with no flow, else accent with flow while playing. */
export const connectionLook = (
  _from: StationState | undefined,
  _playing: boolean,
): { kind: 'flow' | 'blocked'; flowing: boolean } => {
  throw new Error('not implemented');
};
