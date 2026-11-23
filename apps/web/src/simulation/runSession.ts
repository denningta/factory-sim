import type { Project } from '@factory-sim/schema';
import {
  compileLine,
  createRun,
  type LineModel,
  type ModelIssue,
  type RunOptions,
  type RunStats,
} from '@factory-sim/sim-engine';
import { buildLineGeometry, type PartPose } from './partTracks';
import { createPlayback, type Playback } from './playback';

/**
 * One simulation run as the UI sees it. SE-2 (controls), SE-4 (settings) and AN-1 (stats)
 * use only this; it runs on the main thread today and can move into a Worker without
 * changing them.
 */
export interface RunSession {
  play(): void;
  pause(): void;
  /** Advances to the next visible change and pauses. */
  step(): void;
  /** Back to time 0 with the same project and options. */
  reset(): void;
  /** Sim seconds per wall second. */
  setSpeed(x: number): void;
  /** Off: no events are recorded and the run goes as fast as time slices allow. */
  setAnimate(on: boolean): void;
  /** Animation off, then play at full speed until the run ends. */
  runToEnd(): void;
  /** Called by the host once per animation frame; advances the clock while playing. */
  frame(wallSeconds: number): void;
  readonly now: number;
  readonly done: boolean;
  readonly playing: boolean;
  readonly animate: boolean;
  readonly speed: number;
  stats(): RunStats;
  /** Parts on the floor at sim time `t` (none while animation is off). */
  poses(t: number): PartPose[];
  /** Notified when play state, speed, animation, reset or the end of the run changes; not every frame. */
  subscribe(listener: () => void): () => void;
}

export type RunSessionResult =
  { ok: true; session: RunSession } | { ok: false; issues: ModelIssue[] };

export function createRunSession(project: Project, options: RunOptions): RunSessionResult {
  const compiled = compileLine(project);
  if (!compiled.ok) return { ok: false, issues: compiled.issues };
  const model: LineModel = compiled.model;
  const geometry = buildLineGeometry(project.equipment, project.connections);
  const colors = new Map(project.products.map((p) => [p.id, p.color]));
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  let playing = false;
  let speed = 1;
  let animate = true;
  const start = (): Playback => {
    const pb = createPlayback(createRun(model, options), geometry, colors);
    pb.speed = speed;
    pb.animate = animate;
    return pb;
  };
  let pb = start();

  const session: RunSession = {
    play() {
      if (pb.run.done || playing) return;
      playing = true;
      notify();
    },
    pause() {
      if (!playing) return;
      playing = false;
      notify();
    },
    step() {
      playing = false;
      pb.step();
      notify();
    },
    reset() {
      playing = false;
      pb = start();
      notify();
    },
    setSpeed(x) {
      speed = pb.speed = x;
      notify();
    },
    setAnimate(on) {
      animate = pb.animate = on;
      notify();
    },
    runToEnd() {
      throw new Error('not implemented');
    },
    frame(wallSeconds) {
      if (!playing) return;
      pb.advance(wallSeconds);
      if (pb.run.done) {
        playing = false;
        notify();
      }
    },
    get now() {
      return pb.run.now;
    },
    get done() {
      return pb.run.done;
    },
    get playing() {
      return playing;
    },
    get animate() {
      return animate;
    },
    get speed() {
      return speed;
    },
    stats: () => pb.run.stats(),
    poses: (t) => (animate ? pb.tracks.at(t) : []),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return { ok: true, session };
}
