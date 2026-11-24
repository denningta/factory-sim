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

declare const lineModelBrand: unique symbol;

/**
 * An executable, validated line. Opaque: only `createRun` reads it, and only a real
 * `compileLine` result has the brand. It may hold closures, so it isn't postMessage-able:
 * compile and run in the same worker.
 */
export interface LineModel {
  readonly [lineModelBrand]: true;
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

/**
 * Station state colors in the UI: working green, starved yellow, blocked red, idle gray.
 * Exactly one state at a time, decided in this order, so state fractions sum to 1:
 * 1. `working` if any unit is processing: a manual cycle, or on an automatic station the
 *    machine cycle or a load/unload in progress (the tech is there);
 * 2. else `blocked` if any finished part is held because downstream has no room;
 * 3. else `idle` if work is waiting for a technician (manual cycle, load or unload, or the
 *    tech is walking towards the station);
 * 4. else `starved` (nothing to do, including while a batch is still accumulating).
 *
 * Technicians are released when the manual cycle, load or unload ends. A finished part held
 * for downstream room (`blocked`) never holds a tech: on an automatic station the unload
 * happens as soon as the tech arrives after the machine cycle, without waiting for downstream
 * room, and the part then waits at the station without the tech. (Holding the tech while blocked can deadlock a line where one tech serves two
 * stations.)
 *
 * Buffers with several outputs send out the oldest part whose next hop has room, so a part
 * waiting for one output never holds back parts bound for another.
 */
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
  /**
   * The part leaves the source into the line. The source releases only when the first
   * connection has room; while it has none, the source waits and nothing queues at it. The
   * next release is due `release.interval` after this one, so a saturated line releases at
   * its own pace and WIP stays bounded.
   */
  | { t: SimTime; type: 'partReleased'; partId: number; productId: string; sourceId: string }
  /**
   * The part travels from `t` to `arrivesAt`: along a connection (transfer time, FL-4) or
   * across a conveyor (footprint path at belt speed). The renderer interpolates the segment.
   */
  | {
      t: SimTime;
      type: 'partMoved';
      partId: number;
      via: { connectionId: string } | { equipmentId: string };
      arrivesAt: SimTime;
    }
  /** The part is waiting at (queued in) a station, buffer or sink's input. */
  | { t: SimTime; type: 'partEntered'; partId: number; equipmentId: string }
  /** Processing starts; `endsAt` is known unless the cycle waits on a technician. */
  | {
      t: SimTime;
      type: 'partStarted';
      partId: number;
      equipmentId: string;
      endsAt?: SimTime;
    }
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

/** A part currently in the line, with the latest event that places it (ADR-0008). */
export interface PartInLine {
  partId: number;
  productId: string;
  releasedAt: SimTime;
  /** Latest positional event for this part, recorded even while events are disabled. */
  last: Extract<LineEvent, { type: 'partReleased' | 'partMoved' | 'partEntered' | 'partStarted' }>;
}

/** Where a technician is now (TE-3), tracked even while events are disabled. */
export interface TechInLine {
  techId: string;
  state: TechState;
  /**
   * The station it last arrived at, initially its home station (`null` only for a tech with
   * no stations). While walking, the station it left.
   */
  atId: string | null;
  /** The walk in progress, if any: the `techMoved` event that started it. */
  walk?: Extract<LineEvent, { type: 'techMoved' }>;
}

/** Flow figures for one product, or for all products. Statistics cover the measured window. */
export interface FlowStats {
  released: number;
  completed: number;
  /** Completed per hour of measured time. */
  throughputPerHour: number;
  /** Time-average parts in the system, in transit included (FL-4 AC2). */
  averageWip: number;
  /**
   * Mean seconds from release to exit, for parts that exited in the window. NaN if none
   * (it becomes `null` if stats are ever sent as JSON; the API layer must map it).
   */
  averageLeadTime: number;
}

export interface RunStats {
  /**
   * The measured window: `[warmUp, now]` during a run, `[warmUp, warmUp + runLength]` at the
   * end. While `now <= warmUp` the window is empty: every count, rate and fraction is 0
   * (state records then sum to 0, not 1) and lead time is NaN.
   */
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
  /**
   * Advances to the next moment at which at least one `LineEvent` happens, and runs every
   * kernel event up to it (SE-2 single-step: each step visibly changes something). Returns
   * false once the run is done.
   */
  step(): boolean;
  /**
   * Events since the last call, in time order. While disabled (SE-3 "animation off"),
   * events are not recorded at all, so results are unchanged and runs are faster.
   */
  drainEvents(): LineEvent[];
  setEventsEnabled(enabled: boolean): void;
  /** Every part released and not yet exited, by partId ascending. For re-seeding the renderer when animation is turned back on (SE-3 AC3). */
  wip(): PartInLine[];
  /** Every technician, in model order. For re-seeding tech markers when animation is turned back on (TE-3). */
  techs(): TechInLine[];
  /** Live statistics for the window so far (AN-1 AC3). Cheap enough to call every frame. */
  stats(): RunStats;
}

export type CompileLine = (project: Project) => CompileResult;
export type CreateRun = (model: LineModel, options: RunOptions) => Run;
