import type { Run } from '@factory-sim/sim-engine';
import { createPartTracks, type LineGeometry, type PartTracks } from './partTracks';

export interface Playback {
  readonly run: Run;
  readonly tracks: PartTracks;
  speed: number;
  /** Animation off: no events are recorded and the run goes as fast as time slices allow. */
  animate: boolean;
  /** Advances by one frame of `wallSeconds`; the sim clock is the only clock parts use. */
  advance(wallSeconds: number): void;
  /** Runs to the next visible change (single step). */
  step(): void;
}

export interface PlaybackOptions {
  /** Wall-clock budget per `advance` while animation is off. Default 8 ms. */
  sliceMs?: number;
  nowMs?: () => number;
}

/** Sim seconds simulated between wall-clock checks while animation is off. */
const OFF_CHUNK = 60;

export function createPlayback(
  run: Run,
  geometry: LineGeometry,
  colors: ReadonlyMap<string, string>,
  options: PlaybackOptions = {},
): Playback {
  const sliceMs = options.sliceMs ?? 8;
  const nowMs = options.nowMs ?? (() => performance.now());
  const tracks = createPartTracks(geometry, colors);
  let animate = true;
  tracks.ingest(run.drainEvents()); // the t = 0 events recorded when the run was created
  const pb: Playback = {
    run,
    tracks,
    speed: 1,
    get animate() {
      return animate;
    },
    set animate(on: boolean) {
      if (on === animate) return;
      animate = on;
      run.setEventsEnabled(on);
      tracks.clear();
      // Events weren't recorded while off, so ask the engine which parts are in the line.
      if (on) tracks.seed(run.wip());
    },
    advance(wallSeconds) {
      if (animate) {
        run.runUntil(run.now + wallSeconds * pb.speed);
        tracks.ingest(run.drainEvents());
        return;
      }
      const start = nowMs();
      do run.runUntil(run.now + OFF_CHUNK);
      while (!run.done && nowMs() - start < sliceMs);
    },
    step() {
      run.step();
      if (animate) tracks.ingest(run.drainEvents());
    },
  };
  return pb;
}
