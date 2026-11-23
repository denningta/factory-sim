import type { Run } from '@factory-sim/sim-engine';
import type { LineGeometry, PartTracks } from './partTracks';

export interface Playback {
  readonly run: Run;
  readonly tracks: PartTracks;
  speed: number;
  /** Animation off: no events are recorded and the run goes as fast as time slices allow. */
  animate: boolean;
  /** Advances by one frame of `wallSeconds`; the sim clock is the only clock parts use. */
  advance(wallSeconds: number): void;
}

export interface PlaybackOptions {
  /** Wall-clock budget per `advance` while animation is off. Default 8 ms. */
  sliceMs?: number;
  nowMs?: () => number;
}

export function createPlayback(
  _run: Run,
  _geometry: LineGeometry,
  _colors: ReadonlyMap<string, string>,
  _options?: PlaybackOptions,
): Playback {
  throw new Error('not implemented');
}
