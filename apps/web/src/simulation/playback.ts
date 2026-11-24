import type { Run } from '@factory-sim/sim-engine';
import { createStationStates, type StationStates } from './stationStatus';
import { createTechTracks, type TechInfo, type TechTracks } from './techTracks';
import { createPartTracks, type LineGeometry, type PartTracks } from './partTracks';

export interface Playback {
  readonly run: Run;
  readonly tracks: PartTracks;
  /** Tech walks. Cleared and re-seeded from `run.techs()` when animation is turned back on, as parts are from `run.wip()`. */
  readonly techs: TechTracks;
  /** Latest state of every station, from the same events as the parts. */
  readonly stationStates: StationStates;
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
  /** Technicians to draw. */
  techs?: readonly TechInfo[];
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
  const techs = createTechTracks(geometry, options.techs ?? []);
  // Replaced when animation is toggled: events aren't recorded while off, so old states are stale.
  let stationStates = createStationStates();
  let animate = true;
  const ingest = () => {
    const events = run.drainEvents();
    tracks.ingest(events);
    techs.ingest(events);
    stationStates.ingest(events);
  };
  ingest(); // the t = 0 events recorded when the run was created
  const pb: Playback = {
    run,
    tracks,
    techs,
    get stationStates() {
      return stationStates;
    },
    speed: 1,
    get animate() {
      return animate;
    },
    set animate(on: boolean) {
      if (on === animate) return;
      animate = on;
      run.setEventsEnabled(on);
      tracks.clear();
      stationStates = createStationStates();
      // Events weren't recorded while off, so ask the engine which parts are in the line.
      if (on) {
        tracks.seed(run.wip());
        techs.seed(run.techs());
      }
    },
    advance(wallSeconds) {
      if (animate) {
        run.runUntil(run.now + wallSeconds * pb.speed);
        ingest();
        return;
      }
      const start = nowMs();
      do run.runUntil(run.now + OFF_CHUNK);
      while (!run.done && nowMs() - start < sliceMs);
    },
    step() {
      run.step();
      if (animate) ingest();
    },
  };
  return pb;
}
