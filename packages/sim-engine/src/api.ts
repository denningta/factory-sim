/**
 * Public API of the discrete-event kernel (ADR-0007). Owned by the lead: builders
 * implement behind these types and propose changes instead of editing them.
 *
 * Scope: the generic kernel that SE-1 delivers (calendar, entities, resources, queues,
 * PRNG, statistics). The line model that turns a `Project` into a run, and the
 * state-event stream the renderer consumes (ADR-0008), are defined in a later lead PR
 * before SE-2/SE-3/SE-4 start.
 *
 * Units: all times are seconds of simulated time (`SimTime`).
 *
 * Determinism rules every implementation must keep:
 * - No `Math.random`, `Date.now`, timers or async. Randomness comes from `Rng` only.
 * - Events at the same time run in ascending `priority`, then in the order they
 *   were scheduled (FIFO). Same seed + same calls ⇒ identical event order and results.
 * - Waiting requests (resources, queues) are served FIFO.
 * - Grants and hand-offs are delivered as zero-delay events, never synchronously
 *   inside `request`/`release`/`put`/`get`, so callbacks never nest. The unit or item
 *   is reserved the moment the grant is decided, so nobody else can take it while the
 *   callback event is pending.
 * - Bit-exact everywhere (ADR-0007): code that affects results uses only + − × ÷ %,
 *   comparisons, integer/bitwise ops, and the exactly specified `Math.abs`, `sign`,
 *   `floor`, `ceil`, `round`, `trunc`, `fround`, `sqrt`, `min`, `max`, `imul`, `clz32`.
 *   `Math.log`, `exp`, `pow`, trig and the `**` operator are implementation-approximated
 *   in ECMAScript and may differ in the last bit between engines, so the engine ships
 *   its own versions built from exact operations. Lint enforces this in
 *   `packages/sim-engine/src` (tests excluded).
 *
 * Misuse (negative or non-finite delays, `runUntil` into the past or from inside an
 * event, releasing a unit not held) throws an Error: these are programming bugs, not
 * model errors.
 */

/** Simulated time in seconds. */
export type SimTime = number;

/** Seeded pseudo-random number generator. Must be bit-exact across browser and Node. */
export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform in [min, max). */
  uniform(min: number, max: number): number;
  /** Integer uniform in [min, max). */
  integer(min: number, max: number): number;
  /** Exponentially distributed with the given mean (> 0). */
  exponential(mean: number): number;
  /**
   * An independent stream derived from this generator's seed and `label` (e.g. by
   * hashing the label into the seed), unaffected by how many numbers this generator
   * has drawn. One stream per source/station keeps a model edit in one place from
   * shifting the randomness everywhere else.
   */
  fork(label: string): Rng;
}

export interface EventHandle {
  readonly time: SimTime;
  /** Removes the event from the calendar; no-op if it already ran or was cancelled. */
  cancel(): void;
}

/** A pending request on a resource or queue. */
export interface WaitHandle {
  /**
   * Withdraws the request if it hasn't been granted yet and returns true. Returns false
   * once granted (the caller then owns the unit/item and must release/handle it).
   * Lets a station ask several technicians and withdraw the requests it didn't need.
   */
  cancel(): boolean;
}

/** Something that flows through the model (a part). Line code adds its own fields. */
export interface Entity {
  /** Sequential per simulation, starting at 1. */
  readonly id: number;
  readonly createdAt: SimTime;
}

/** Sample statistic (e.g. waiting times). */
export interface Tally {
  add(value: number): void;
  readonly count: number;
  /** NaN when empty. */
  readonly mean: number;
  /** Sample variance; NaN when count < 2. */
  readonly variance: number;
  readonly min: number;
  readonly max: number;
  reset(): void;
}

/** Time-weighted statistic (e.g. queue length, busy units), on the simulation clock. */
export interface TimeWeighted {
  /** Records that the value changes to `value` at the current simulation time. */
  update(value: number): void;
  readonly current: number;
  /** Time-average from the last reset up to `now`; equals `current` when no time has passed. */
  mean(): number;
  /** Restarts averaging at `now`, keeping the current value. */
  reset(): void;
}

/** A pool of identical units (station capacity, a technician). */
export interface Resource {
  readonly name: string;
  readonly capacity: number;
  readonly inUse: number;
  readonly queueLength: number;
  /** Asks for one unit; `onGranted` runs (as an event) once it is held. */
  request(entity: Entity, onGranted: () => void): WaitHandle;
  /** Returns the unit held by `entity`. Throws if `entity` holds none. */
  release(entity: Entity): void;
  /** Time-average of `inUse / capacity` since the last statistics reset. */
  utilization(): number;
  /** Time-average number waiting since the last statistics reset. */
  averageQueueLength(): number;
}

/** A FIFO store with optional finite capacity (a buffer). Full ⇒ `put` waits. */
export interface Queue<T> {
  readonly name: string;
  /** `Infinity` for unbounded. */
  readonly capacity: number;
  readonly length: number;
  /** Stores `item`; `onStored` runs (as an event) once there was room. */
  put(item: T, onStored: () => void): WaitHandle;
  /** Takes the oldest item; `onItem` runs (as an event) once one is available. */
  get(onItem: (item: T) => void): WaitHandle;
  /** Time-average length since the last statistics reset. */
  averageLength(): number;
}

export interface SimulationOptions {
  /** Seed for `sim.rng`. An integer; normalized with `>>> 0`. Non-integers throw. */
  seed: number;
}

export interface Simulation {
  readonly now: SimTime;
  readonly rng: Rng;
  /** Events still on the calendar, excluding cancelled ones. */
  readonly pendingEvents: number;

  /**
   * Runs `action` at `now + delay`. `delay` must be finite and ≥ 0. Lower priority runs
   * first among events at the same time; default 0.
   */
  schedule(delay: SimTime, action: () => void, priority?: number): EventHandle;
  /** Runs the next event. Returns false if the calendar was empty. Throws if called from inside an event. */
  step(): boolean;
  /**
   * Runs every event with time ≤ `time` (including ones scheduled at `time` while doing
   * so), then advances `now` to `time`. Throws if `time < now` or if called from inside
   * an event. SE-2 drives play/pause/speed by calling this in slices.
   */
  runUntil(time: SimTime): void;

  /**
   * Creates an entity with the next id, stamped with `now`, merged with `data`.
   * `data` may not contain `id` or `createdAt`.
   */
  createEntity<T extends object>(data: T & { id?: never; createdAt?: never }): Entity & T;
  /** `capacity` is a positive integer (WS-3 parallel fixtures). */
  createResource(name: string, capacity: number): Resource;
  /** `capacity` is a positive integer or `Infinity` (default). */
  createQueue<T>(name: string, capacity?: number): Queue<T>;
  createTally(): Tally;
  createTimeWeighted(initial?: number): TimeWeighted;

  /**
   * Resets every statistic created by this simulation (tallies, time-weighted stats,
   * resource and queue averages) at `now`. Used to drop the warm-up period (SE-4).
   */
  resetStatistics(): void;
}

export type CreateSimulation = (options: SimulationOptions) => Simulation;
export type CreateRng = (seed: number) => Rng;
