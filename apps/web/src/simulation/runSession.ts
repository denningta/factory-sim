import type { Project } from '@factory-sim/schema';
import type { ModelIssue, RunOptions, RunStats } from '@factory-sim/sim-engine';
import type { PartPose } from './partTracks';

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
  setAnimate(on: boolean): void;
  /** Called by the host once per animation frame; advances the clock if playing. */
  frame(wallSeconds: number): void;
  readonly now: number;
  readonly done: boolean;
  readonly playing: boolean;
  readonly animate: boolean;
  stats(): RunStats;
  /** Parts on the floor at sim time `t`. */
  poses(t: number): PartPose[];
  /** Notified when play state, clock-finished or reset changes (not every frame). */
  subscribe(listener: () => void): () => void;
}

export type RunSessionResult =
  { ok: true; session: RunSession } | { ok: false; issues: ModelIssue[] };

export function createRunSession(_project: Project, _options: RunOptions): RunSessionResult {
  throw new Error('not implemented');
}
