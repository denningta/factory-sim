/**
 * `createRun` (SE-6): runs a compiled line on the kernel. Parts follow their precomputed
 * route; every place a part can occupy (connection, buffer, conveyor, station, sink) is a
 * `Place` with a capacity and a FIFO of parts waiting for room. Room is reserved the moment
 * it is granted and the move is delivered as a zero-delay event, like the kernel's queues.
 *
 * Engine rules (line-api.ts): the source releases only when the first hop has room
 * (nothing queues at it) and the next release is due one interval later; load/unload counts
 * as working; a station releases its tech before it blocks; a buffer sends out the oldest
 * part that can move (a part blocked on its next place does not hold back later ones; each
 * place's waiters are FIFO).
 */
import type { Entity, EventHandle, Resource, Simulation, TimeWeighted } from './api';
import type { CompiledLine, Leg, ProductDef, StationDef } from './line-compile';
import type {
  FlowStats,
  LineEvent,
  PartInLine,
  BatchInLine,
  Run,
  RunOptions,
  RunStats,
  StationState,
  TechState,
} from './line-api';
import { durationSampler } from './distributions';
import { createSimulation } from './simulation';

interface Place {
  readonly capacity: number;
  used: number;
  readonly waiters: (() => void)[];
  /** Runs after a part leaves (and its room is freed). */
  onLeave?: () => void;
}

interface Part extends Entity {
  readonly product: ProductRt;
  /** Index of the next leg in the route. */
  leg: number;
  holder: Place;
}

interface FlowRt {
  released: number;
  completed: number;
  wip: TimeWeighted;
  lead: ReturnType<Simulation['createTally']>;
}

interface ProductRt {
  readonly def: ProductDef;
  readonly flow: FlowRt;
  /** Cycle-time sampler per route leg index (station steps only). */
  readonly cycles: (() => number)[];
}

interface TechRt {
  readonly id: string;
  readonly resource: Resource;
  readonly walkSpeed: number;
  location: StationRt | undefined;
  /** The walk in progress, for `Run.techs()` (TE-3). */
  walk: Extract<LineEvent, { type: 'techMoved' }> | undefined;
  state: TechState;
  readonly stateStats: Record<TechState, TimeWeighted>;
}

interface StationRt {
  readonly def: StationDef;
  readonly place: Place;
  /** Parts waiting for their batch to start, with when they arrived. */
  readonly waiting: Waiting[];
  /** The `maxWait` timer and the part it is timing (always `waiting[0]`). */
  timer?: { part: Part; handle: EventHandle };
  /** perBatch cure sampler (SF-6); else each part's own cycle time. */
  readonly cure?: () => number;
  /** Units processing (cycle, machine cycle, load or unload). */
  processing: number;
  /** Finished parts that can't move on yet. */
  held: number;
  /** Jobs waiting for a technician (requested or walking). */
  awaiting: number;
  state: StationState;
  readonly stateStats: Record<StationState, TimeWeighted>;
  techs: TechRt[];
  readonly load?: () => number;
  readonly unload?: () => number;
}

interface Waiting {
  part: Part;
  cycle: () => number;
  since: number;
}

const STATION_STATES: readonly StationState[] = ['working', 'starved', 'blocked', 'idle'];
const TECH_STATES: readonly TechState[] = ['working', 'walking', 'idle'];

export function startRun(line: CompiledLine, options: RunOptions): Run {
  const { seed, warmUp, runLength } = options;
  if (!(Number.isFinite(warmUp) && warmUp >= 0 && Number.isFinite(runLength) && runLength >= 0))
    throw new Error(`warmUp and runLength must be finite and >= 0, got ${warmUp}, ${runLength}`);
  const sim = createSimulation({ seed });
  const rng = sim.rng;
  const endTime = warmUp + runLength;

  // ---- events ----
  let eventsEnabled = true;
  let events: LineEvent[] = [];
  /** Counts events whether recorded or not, so `step()` works with events off. */
  let emitted = 0;
  /** Parts in the line and their latest positional event; kept even while events are off. */
  const inLine = new Map<number, PartInLine>();
  const emit = (event: LineEvent) => {
    emitted++;
    if (event.type === 'partReleased')
      inLine.set(event.partId, {
        partId: event.partId,
        productId: event.productId,
        releasedAt: event.t,
        last: event,
      });
    else if (event.type === 'partExited') inLine.delete(event.partId);
    else if (
      event.type === 'partMoved' ||
      event.type === 'partEntered' ||
      event.type === 'partStarted' ||
      event.type === 'partFinished'
    ) {
      const p = inLine.get(event.partId);
      if (p) p.last = event;
    }
    if (eventsEnabled) events.push(event);
  };
  const defer = (action: () => void) => void sim.schedule(0, action);

  // ---- places ----
  const place = (capacity: number): Place => ({ capacity, used: 0, waiters: [] });
  const requestRoom = (p: Place, onRoom: () => void) => {
    if (p.waiters.length === 0 && p.used < p.capacity) {
      p.used++;
      defer(onRoom);
    } else p.waiters.push(onRoom);
  };
  const leave = (part: Part) => {
    const p = part.holder;
    p.used--;
    while (p.waiters.length > 0 && p.used < p.capacity) {
      p.used++;
      defer(p.waiters.shift()!);
    }
    p.onLeave?.();
  };

  // ---- statistics ----
  const flow = (): FlowRt => ({
    released: 0,
    completed: 0,
    wip: sim.createTimeWeighted(0),
    lead: sim.createTally(),
  });
  const total = flow();
  const indicators = <S extends string>(states: readonly S[], initial: S) =>
    Object.fromEntries(
      states.map((s) => [s, sim.createTimeWeighted(s === initial ? 1 : 0)]),
    ) as Record<S, TimeWeighted>;

  // ---- technicians ----
  const techs = new Map<string, TechRt>(
    line.techs.map((t) => [
      t.id,
      {
        id: t.id,
        resource: sim.createResource(t.id, 1),
        walkSpeed: t.walkSpeed,
        location: undefined,
        walk: undefined,
        state: 'idle',
        stateStats: indicators(TECH_STATES, 'idle'),
      },
    ]),
  );
  const setTech = (tech: TechRt, state: TechState) => {
    if (tech.state === state) return;
    tech.stateStats[tech.state].update(0);
    tech.stateStats[state].update(1);
    tech.state = state;
    emit({ t: sim.now, type: 'techState', techId: tech.id, state });
  };

  // ---- stations ----
  const stations = new Map<string, StationRt>();
  for (const def of line.stations) {
    const labor = def.labor;
    const st: StationRt = {
      def,
      place: place(def.capacity),
      waiting: [],
      processing: 0,
      held: 0,
      awaiting: 0,
      state: 'starved',
      stateStats: indicators(STATION_STATES, 'starved'),
      techs: [],
      ...(def.cure && { cure: durationSampler(rng.fork(`cure:${def.id}`), def.cure) }),
      ...(labor.mode === 'automatic' && {
        load: durationSampler(rng.fork(`load:${def.id}`), labor.loadTime),
        unload: durationSampler(rng.fork(`unload:${def.id}`), labor.unloadTime),
      }),
    };
    st.place.onLeave = () => {
      st.held--;
      refresh(st);
    };
    stations.set(def.id, st);
  }
  for (const def of line.stations) {
    const st = stations.get(def.id)!;
    st.techs = def.techIds.map((id) => techs.get(id)!);
  }
  for (const t of line.techs) techs.get(t.id)!.location = t.home ? stations.get(t.home) : undefined;

  const refresh = (st: StationRt) => {
    const state: StationState =
      st.processing > 0
        ? 'working'
        : st.held > 0
          ? 'blocked'
          : st.awaiting > 0
            ? 'idle'
            : 'starved';
    if (state === st.state) return;
    st.stateStats[st.state].update(0);
    st.stateStats[state].update(1);
    st.state = state;
    emit({ t: sim.now, type: 'stationState', stationId: st.def.id, state });
  };

  /**
   * Gets one of the station's techs (whichever is granted first) to the station, then runs
   * `work`. Without assigned techs (automatic stations only) the work runs unattended.
   */
  const withTech = (st: StationRt, entity: Entity, work: (tech: TechRt | undefined) => void) => {
    if (st.techs.length === 0) {
      work(undefined);
      return;
    }
    st.awaiting++;
    refresh(st);
    let got: TechRt | undefined;
    const handles = st.techs.map((tech) =>
      tech.resource.request(entity, () => {
        if (got) {
          tech.resource.release(entity); // granted at the same moment as another: not needed
          return;
        }
        got = tech;
        for (const h of handles) h.cancel();
        const arrive = () => {
          tech.location = st;
          tech.walk = undefined;
          st.awaiting--;
          setTech(tech, 'working');
          work(tech);
        };
        const from = tech.location;
        if (from === undefined || from === st) {
          arrive();
          return;
        }
        const dx = st.def.position.x - from.def.position.x;
        const dy = st.def.position.y - from.def.position.y;
        const walk = Math.sqrt(dx * dx + dy * dy) / tech.walkSpeed;
        setTech(tech, 'walking');
        tech.walk = {
          t: sim.now,
          type: 'techMoved',
          techId: tech.id,
          fromId: from.def.id,
          toId: st.def.id,
          arrivesAt: sim.now + walk,
        };
        emit({ ...tech.walk });
        sim.schedule(walk, arrive);
      }),
    );
  };
  const freeTech = (tech: TechRt | undefined, entity: Entity) => {
    if (!tech) return;
    tech.resource.release(entity);
    // A tech re-granted at this same moment flips back to working in that grant's event.
    setTech(tech, 'idle');
  };

  const tryStart = (st: StationRt) => {
    const { batchSize, maxWait } = st.def;
    while (st.waiting.length >= batchSize) startJob(st, st.waiting.splice(0, batchSize));
    if (maxWait !== undefined) armTimer(st, maxWait);
    refresh(st);
  };

  /**
   * Keeps one `maxWait` timer on the first waiting part (SF-6). A full batch that takes that
   * part cancels it; when it fires, every waiting part (fewer than a batch) starts.
   */
  const armTimer = (st: StationRt, maxWait: number) => {
    const head = st.waiting[0];
    if (st.timer?.part === head?.part) return;
    st.timer?.handle.cancel();
    st.timer = undefined;
    if (!head) return;
    const handle = sim.schedule(head.since + maxWait - sim.now, () => {
      st.timer = undefined;
      startJob(st, st.waiting.splice(0));
      refresh(st);
    });
    st.timer = { part: head.part, handle };
  };

  /** Cures in progress, for `Run.batches()`; insertion order = start order. */
  const activeBatches = new Set<BatchInLine>();

  const startJob = (st: StationRt, batch: Waiting[]) => {
    const lead = batch[0]!;
    const cycle = st.cure ?? lead.cycle;
    const partIds = () => batch.map((w) => w.part.id);
    const finish = () => {
      st.held += batch.length;
      refresh(st);
      for (const { part } of batch)
        emit({ t: sim.now, type: 'partFinished', partId: part.id, equipmentId: st.def.id });
      for (const { part } of batch) advance(part);
    };
    const started = (endsAt?: number) => {
      for (const { part } of batch)
        emit({
          t: sim.now,
          type: 'partStarted',
          partId: part.id,
          equipmentId: st.def.id,
          ...(endsAt !== undefined && { endsAt }),
        });
    };
    /** Runs the cycle (cure) itself; batch events mark it on batch stations (ADR-0017). */
    const runCycle = (t: number, done: () => void) => {
      const running = st.def.batches
        ? { equipmentId: st.def.id, partIds: partIds(), startedAt: sim.now, endsAt: sim.now + t }
        : undefined;
      if (running) {
        activeBatches.add(running);
        emit({
          t: sim.now,
          type: 'batchStarted',
          equipmentId: running.equipmentId,
          partIds: running.partIds,
          endsAt: running.endsAt,
        });
      }
      sim.schedule(t, () => {
        if (running) {
          activeBatches.delete(running);
          emit({ t: sim.now, type: 'batchFinished', equipmentId: st.def.id, partIds: partIds() });
        }
        done();
      });
    };
    if (!st.load || !st.unload) {
      withTech(st, lead.part, (tech) => {
        const t = cycle();
        st.processing++;
        started(sim.now + t);
        refresh(st);
        runCycle(t, () => {
          st.processing--;
          freeTech(tech, lead.part);
          finish();
        });
      });
      return;
    }
    const { load, unload } = st;
    withTech(st, lead.part, (tech) => {
      st.processing++;
      started();
      refresh(st);
      sim.schedule(load(), () => {
        freeTech(tech, lead.part);
        runCycle(cycle(), () => {
          st.processing--;
          withTech(st, lead.part, (tech2) => {
            st.processing++;
            refresh(st);
            sim.schedule(unload(), () => {
              st.processing--;
              freeTech(tech2, lead.part);
              finish();
            });
          });
        });
      });
    });
  };

  // ---- parts moving along their routes ----
  const nodePlaces = new Map<string, Place>();
  const connPlaces = new Map<string, Place>();
  const transfers = new Map<string, () => number>();
  for (const pr of line.products)
    for (const leg of pr.route) {
      const { connection: c, node } = leg;
      if (!connPlaces.has(c.id)) {
        connPlaces.set(c.id, place(c.capacity));
        const tr = c.transfer;
        transfers.set(
          c.id,
          tr.kind === 'instant'
            ? () => 0
            : tr.kind === 'seconds'
              ? () => tr.value
              : durationSampler(rng.fork(`transfer:${c.id}`), tr.time),
        );
      }
      if (!nodePlaces.has(node.id))
        nodePlaces.set(
          node.id,
          node.kind === 'station'
            ? stations.get(node.id)!.place
            : place(node.kind === 'buffer' ? node.capacity : Infinity),
        );
    }

  /** Where a part on `leg` needs room first: the connection, or the node on a direct hand-off. */
  const firstPlace = (leg: Leg) =>
    leg.connection.capacity === 0
      ? nodePlaces.get(leg.node.id)!
      : connPlaces.get(leg.connection.id)!;

  const advance = (part: Part) => {
    const leg = part.product.def.route[part.leg]!;
    const target = firstPlace(leg);
    requestRoom(target, () => depart(part, leg, target));
  };

  const depart = (part: Part, leg: Leg, target: Place) => {
    leave(part);
    part.holder = target;
    const t = transfers.get(leg.connection.id)!();
    emit({
      t: sim.now,
      type: 'partMoved',
      partId: part.id,
      via: { connectionId: leg.connection.id },
      arrivesAt: sim.now + t,
    });
    const nodePlace = nodePlaces.get(leg.node.id)!;
    if (target === nodePlace) {
      sim.schedule(t, () => enter(part, leg));
      return;
    }
    sim.schedule(t, () =>
      requestRoom(nodePlace, () => {
        leave(part);
        part.holder = nodePlace;
        enter(part, leg);
      }),
    );
  };

  const enter = (part: Part, leg: Leg) => {
    const index = part.leg++;
    const node = leg.node;
    switch (node.kind) {
      case 'sink': {
        emit({ t: sim.now, type: 'partExited', partId: part.id, sinkId: node.id });
        leave(part);
        const pf = part.product.flow;
        for (const f of [pf, total]) {
          f.completed++;
          f.wip.update(f.wip.current - 1);
          f.lead.add(sim.now - part.createdAt);
        }
        return;
      }
      case 'buffer':
        emit({ t: sim.now, type: 'partEntered', partId: part.id, equipmentId: node.id });
        advance(part);
        return;
      case 'conveyor':
        emit({
          t: sim.now,
          type: 'partMoved',
          partId: part.id,
          via: { equipmentId: node.id },
          arrivesAt: sim.now + node.travel,
        });
        sim.schedule(node.travel, () => advance(part));
        return;
      case 'station': {
        emit({ t: sim.now, type: 'partEntered', partId: part.id, equipmentId: node.id });
        const st = stations.get(node.id)!;
        st.waiting.push({ part, cycle: part.product.cycles[index]!, since: sim.now });
        tryStart(st);
      }
    }
  };

  // ---- release ----
  const products: ProductRt[] = line.products.map((def) => ({
    def,
    flow: flow(),
    cycles: def.route.map((leg) =>
      leg.cycle ? durationSampler(rng.fork(`cycle:${def.id}:${leg.node.id}`), leg.cycle) : () => 0,
    ),
  }));
  const interval = durationSampler(rng.fork('release'), line.release.interval);
  const pickProduct = productPicker(line, products, rng.fork('release-product'));
  /** Parts exist only once they leave the source, so it never holds one: no capacity. */
  const source = place(Infinity);
  /**
   * A release is due: wait for room on the first hop (nothing queues at the source), then
   * release the part into the line. The next release is due one interval after this one.
   */
  const due = () => {
    const product = pickProduct();
    const leg = product.def.route[0]!;
    const target = firstPlace(leg);
    requestRoom(target, () => {
      const part: Part = sim.createEntity({ product, leg: 0, holder: source });
      source.used++;
      for (const f of [product.flow, total]) {
        f.released++;
        f.wip.update(f.wip.current + 1);
      }
      emit({
        t: sim.now,
        type: 'partReleased',
        partId: part.id,
        productId: product.def.id,
        sourceId: line.sourceId,
      });
      depart(part, leg, target);
      sim.schedule(interval(), due);
    });
  };

  // ---- run control ----
  for (const st of stations.values())
    emit({ t: 0, type: 'stationState', stationId: st.def.id, state: 'starved' });
  for (const tech of techs.values())
    emit({ t: 0, type: 'techState', techId: tech.id, state: 'idle' });

  const flows = [total, ...products.map((p) => p.flow)];
  // Lowest priority first: the reset precedes everything else at `warmUp`.
  sim.schedule(
    warmUp,
    () => {
      sim.resetStatistics();
      for (const f of flows) {
        f.released = 0;
        f.completed = 0;
      }
    },
    -Number.MAX_VALUE,
  );
  sim.schedule(0, due);
  let done = false;
  // Highest priority: runs after every other event at `endTime`.
  sim.schedule(endTime, () => (done = true), Number.MAX_VALUE);

  const flowStats = (f: FlowRt, window: number): FlowStats =>
    window > 0
      ? {
          released: f.released,
          completed: f.completed,
          throughputPerHour: (f.completed / window) * 3600,
          averageWip: f.wip.mean(),
          averageLeadTime: f.lead.mean,
        }
      : { released: 0, completed: 0, throughputPerHour: 0, averageWip: 0, averageLeadTime: NaN };
  const fractions = <S extends string>(rec: Record<S, TimeWeighted>, window: number) =>
    Object.fromEntries(
      Object.entries<TimeWeighted>(rec).map(([s, tw]) => [s, window > 0 ? tw.mean() : 0]),
    ) as Record<S, number>;

  return {
    get now() {
      return sim.now;
    },
    endTime,
    get done() {
      return done;
    },
    runUntil(time) {
      if (done || !(time > sim.now)) return;
      sim.runUntil(Math.min(time, endTime));
    },
    step() {
      if (done) return false;
      const before = emitted;
      while (!done && emitted === before) sim.step();
      if (!done) sim.runUntil(sim.now); // the rest of this moment
      return emitted > before;
    },
    drainEvents() {
      const out = events;
      events = [];
      return out;
    },
    setEventsEnabled(enabled) {
      eventsEnabled = enabled;
    },
    wip() {
      // Copies, so a caller can't see later events change what it holds.
      return [...inLine.values()].map((p) => ({ ...p })).sort((a, b) => a.partId - b.partId);
    },
    techs() {
      // Map insertion order = model order (built from line.techs).
      return [...techs.values()].map((t) => ({
        techId: t.id,
        state: t.state,
        atId: t.location?.def.id ?? null,
        ...(t.walk ? { walk: { ...t.walk } } : {}),
      }));
    },
    stationStates() {
      // Map insertion order = model order (built from line.stations).
      return Object.fromEntries([...stations.values()].map((st) => [st.def.id, st.state]));
    },
    batches() {
      return [...activeBatches].map((b) => ({ ...b, partIds: [...b.partIds] }));
    },
    stats(): RunStats {
      const to = Math.max(warmUp, Math.min(sim.now, endTime));
      const window = to - warmUp;
      return {
        window: { from: warmUp, to },
        byProduct: Object.fromEntries(products.map((p) => [p.def.id, flowStats(p.flow, window)])),
        total: flowStats(total, window),
        stations: Object.fromEntries(
          [...stations.values()].map((st) => [st.def.id, fractions(st.stateStats, window)]),
        ),
        techs: Object.fromEntries(
          [...techs.values()].map((t) => [t.id, fractions(t.stateStats, window)]),
        ),
      };
    },
  };
}

/** Which product the next release is (PR-4 release rule). */
function productPicker(
  line: CompiledLine,
  products: ProductRt[],
  rng: ReturnType<Simulation['rng']['fork']>,
): () => ProductRt {
  const rule = line.release.product;
  const { weights } = line;
  const sum = weights.reduce((a, b) => a + b, 0);
  if (rule.kind === 'sequence') {
    const byId = new Map(products.map((p) => [p.def.id, p]));
    const pattern = rule.pattern.map((id) => byId.get(id)!);
    let i = 0;
    return () => pattern[i++ % pattern.length]!;
  }
  if (rule.kind === 'random')
    return () => {
      let u = rng.next() * sum;
      for (let i = 0; i < products.length - 1; i++) {
        u -= weights[i]!;
        if (u < 0) return products[i]!;
      }
      return products[products.length - 1]!;
    };
  // Smooth: largest accumulated share goes next (ties: document order), so the mix is met
  // as evenly as possible.
  const credit = weights.map(() => 0);
  return () => {
    let best = 0;
    for (let i = 0; i < products.length; i++) {
      credit[i]! += weights[i]!;
      if (credit[i]! > credit[best]!) best = i;
    }
    credit[best]! -= sum;
    return products[best]!;
  };
}
