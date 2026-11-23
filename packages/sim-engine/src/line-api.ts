/**
 * Public API of the line model: turning a project document into a running simulation
 * (ADR-0007, ADR-0008, ADR-0009). Owned by the lead, like `api.ts`. Builders implement
 * behind it and propose changes instead of editing it.
 *
 * Flow: `compileLine(project)` checks the model and builds an executable line from the
 * kernel (`api.ts`). `createRun(model, options)` gives a `Run` that the UI steps in slices
 * (SE-2), whose `LineEvent`s the renderer interpolates on its own clock (ADR-0008, ADR-0014)
 * and whose `stats()` feed the KPIs (AN-1, AN-2).
 *
 * Units: seconds and meters, like the document. Determinism: same project + same options ⇒
 * identical events and stats (SE-4 AC2). Every random draw comes from a stream forked per
 * object id (`Rng.fork`), so editing one station doesn't change another's samples.
 */
import type { Project } from '@factory-sim/schema';
import type { SimTime } from './api';

// ---- Compile (pre-run checks: FL-3, SE-5) ----

export interface ModelIssue {
  /** Stable machine code, e.g. 'no_products', 'no_path', 'manual_station_without_tech'. */
  code: string;
  /** Plain-language message for the issues list. */
  message: string;
  /** The object to select when the issue is clicked (SE-5 AC2), if any. */
  objectId?: string;
  /** Errors block a run (SE-5 AC3); warnings don't. */
  severity: 'error' | 'warning';
}

/** An executable, validated line. Opaque: only `createRun` reads it. */
export interface LineModel {
  readonly kind: 'line-model';
}

export type CompileResult =
  { ok: true; model: LineModel; warnings: ModelIssue[] } | { ok: false; issues: ModelIssue[] };

// ---- Run (SE-2, SE-4) ----

export interface RunOptions {
  /** Any integer; same seed ⇒ same run (SE-4). */
  seed: number;
  /** Seconds simulated before statistics start (SE-4 AC1). */
  warmUp: SimTime;
  /** Seconds simulated after the warm-up. The run ends at `warmUp + runLength`. */
  runLength: SimTime;
}

/** Station state colors in the UI: working green, starved yellow, blocked red, idle gray. */
export type StationState =
  /** Processing a part (or a batch). */
  | 'working'
  /** Free, waiting for a part to arrive. */
  | 'starved'
  /** Finished, but downstream has no room. */
  | 'blocked'
  /** Has work but waits for a technician (manual cycle, or load/unload). */
  | 'idle';

export type TechState = 'working' | 'walking' | 'idle';

/**
 * State changes with sim timestamps (ADR-0008). Moves carry their own end time so the
 * renderer can interpolate without asking the engine (segment tracks, ADR-0014).
 */
export type LineEvent =
  | { t: SimTime; type: 'partReleased'; partId: number; productId: string; sourceId: string }
  | { t: SimTime; type: 'partMoved'; partId: number; connectionId: string; arrivesAt: SimTime }
  | { t: SimTime; type: 'partEntered'; partId: number; equipmentId: string }
  | { t: SimTime; type: 'partExited'; partId: number; sinkId: string }
  | { t: SimTime; type: 'stationState'; stationId: string; state: StationState }
  | {
      t: SimTime;
      type: 'techMoved';
      techId: string;
      fromId: string;
      toId: string;
      arrivesAt: SimTime;
    }
  | { t: SimTime; type: 'techState'; techId: string; state: TechState };

/** Flow figures for one product, or for all products. Statistics cover the measured window. */
export interface FlowStats {
  released: number;
  completed: number;
  /** Completed per hour of measured time. */
  throughputPerHour: number;
  /** Time-average parts in the system, in transit included (FL-4 AC2). */
  averageWip: number;
  /** Mean seconds from release to exit, for parts that exited in the window. NaN if none. */
  averageLeadTime: number;
}

export interface RunStats {
  /** The measured window: `[warmUp, now]` during a run, `[warmUp, warmUp + runLength]` at the end. */
  window: { from: SimTime; to: SimTime };
  byProduct: Record<string, FlowStats>;
  total: FlowStats;
  /** Fraction of the window in each state, per station; each record sums to 1. */
  stations: Record<string, Record<StationState, number>>;
  /** Fraction of the window in each state, per technician; each record sums to 1. */
  techs: Record<string, Record<TechState, number>>;
}

export interface Run {
  readonly now: SimTime;
  /** `warmUp + runLength`. */
  readonly endTime: SimTime;
  readonly done: boolean;
  /** Advances to `min(time, endTime)` (SE-2: play in slices, "run to end"). */
  runUntil(time: SimTime): void;
  /** Runs the next event (SE-2 single-step). Returns false once the run is done. */
  step(): boolean;
  /**
   * Events since the last call, in time order. While disabled (SE-3 "animation off"),
   * events are not recorded at all, so results are unchanged and runs are faster.
   */
  drainEvents(): LineEvent[];
  setEventsEnabled(enabled: boolean): void;
  /** Live statistics for the window so far (AN-1 AC3). Cheap enough to call every frame. */
  stats(): RunStats;
}

export type CompileLine = (project: Project) => CompileResult;
export type CreateRun = (model: LineModel, options: RunOptions) => Run;
