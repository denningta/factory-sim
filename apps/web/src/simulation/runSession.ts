import type { Project } from '@factory-sim/schema';
import {
  compileLine,
  createRun,
  type LineModel,
  type ModelIssue,
  type RunOptions,
  type RunStats,
  type StationState,
} from '@factory-sim/sim-engine';
import { buildLineGeometry, type CureState, type PartPose } from './partTracks';
import type { TechPose } from './techTracks';
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
  /** Latest state of each workstation (empty while animation is off: no events are recorded). */
  stationStates(): ReadonlyMap<string, StationState>;
  /** Parts waiting at each station's input as of the last `poses` call (empty while animation is off). */
  queueLengths(): ReadonlyMap<string, number>;
  /** Parts on the floor at sim time `t` (none while animation is off). */
  poses(t: number): PartPose[];
  /** Door, cart and cure progress of an autoclave at sim time `t` (SF-5). */
  cureState(equipmentId: string, t: number): CureState;
  /** Techs at sim time `t`, standing or walking (none while animation is off, like parts). */
  techPoses(t: number): TechPose[];
  /** Notified when play state, speed, animation, reset or the end of the run changes; not every frame. */
  subscribe(listener: () => void): () => void;
}

export type RunSessionResult =
  { ok: true; session: RunSession } | { ok: false; issues: ModelIssue[] };

/** Speed range in sim seconds per wall second. */
const MIN_SPEED = 1;
const MAX_SPEED = 1000;

export function createRunSession(project: Project, options: RunOptions): RunSessionResult {
  const compiled = compileLine(project);
  if (!compiled.ok) return { ok: false, issues: compiled.issues };
  const model: LineModel = compiled.model;
  const geometry = buildLineGeometry(project.equipment, project.connections);
  const colors = new Map(project.products.map((p) => [p.id, p.color]));
  const techInfo = project.technicians.map((t) => ({
    id: t.id,
    name: t.name,
    homeId: t.stationIds[0],
    stationIds: t.stationIds,
  }));
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  let playing = false;
  let speed = 1;
  let animate = true;
  const start = (): Playback => {
    const pb = createPlayback(createRun(model, options), geometry, colors, { techs: techInfo });
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
      speed = pb.speed = Number.isFinite(x)
        ? Math.min(MAX_SPEED, Math.max(MIN_SPEED, x))
        : MIN_SPEED;
      notify();
    },
    setAnimate(on) {
      animate = pb.animate = on;
      notify();
    },
    runToEnd() {
      animate = pb.animate = false;
      if (pb.run.done) return notify();
      playing = true;
      notify();
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
    stationStates: () => pb.stationStates.current(),
    techPoses: (t) => (animate ? pb.techs.at(t) : []),
    queueLengths: () => (animate ? pb.tracks.queueLengths() : new Map()),
    poses: (t) => (animate ? pb.tracks.at(t) : []),
    cureState: (id, t) => pb.tracks.cure(id, t),
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  return { ok: true, session };
}
