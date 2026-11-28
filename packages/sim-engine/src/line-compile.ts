/**
 * `compileLine` (SE-6): checks a project for problems that block a run (`ModelIssue`s) and
 * turns it into plain, precomputed data for `line-run.ts`. Everything that doesn't depend
 * on the seed (each step's candidate paths, distances, release weights) is done here, once.
 */
import type { Duration, Equipment, Labor, Port, Project } from '@factory-sim/schema';
import type { ModelIssue } from './line-api';
import { sinCos } from './math';

export interface ConnectionDef {
  id: string;
  /** Parts that can wait on it; `Infinity` = unlimited; 0 = direct hand-off. */
  capacity: number;
  transfer:
    { kind: 'instant' } | { kind: 'fixed'; time: Duration } | { kind: 'seconds'; value: number };
}

export type NodeDef =
  | { kind: 'station'; id: string }
  | { kind: 'buffer'; id: string; capacity: number }
  | { kind: 'conveyor'; id: string; travel: number }
  | { kind: 'sink'; id: string };

/** One hop of a part's route: along `connection` into `node`. */
export interface Leg {
  connection: ConnectionDef;
  node: NodeDef;
}

/** One way to do a step from a given place: the path to the step's station (or a sink). */
export interface OptionDef {
  /** The step's workstation; absent on the final hop to a sink. */
  stationId?: string;
  legs: Leg[];
  cycle?: Duration;
}

/**
 * One routing step, plus a final one to a sink. Candidates are resolved at run time
 * (ADR-0018): per place the part comes from (the source, or any station of the previous
 * step), the step's stations in listed order (`stationId` first).
 */
export interface StepDef {
  from: Map<string, OptionDef[]>;
}

export interface ProductDef {
  id: string;
  steps: StepDef[];
}

export interface StationDef {
  id: string;
  capacity: number;
  batchSize: number;
  labor: Labor;
  position: { x: number; y: number };
  /** Technicians assigned to it, in document order. */
  techIds: string[];
  /** `cycle.mode = 'perBatch'` (SF-6): one cure of this time per batch, any parts. */
  cure?: Duration;
  /** Seconds the first waiting part waits before a partial batch starts (SF-6). */
  maxWait?: number;
  /** Emits batch events (ADR-0017): `batchSize` > 1 or perBatch. */
  batches: boolean;
}

export interface TechDef {
  id: string;
  walkSpeed: number;
  /** Starts at its first assigned station. */
  home: string | undefined;
}

export interface CompiledLine {
  sourceId: string;
  stations: StationDef[];
  techs: TechDef[];
  products: ProductDef[];
  release: Project['release'];
  /** Release weight per product (demand), aligned with `products`. */
  weights: number[];
}

/** World position of a port (same convention as the layout editor). */
function portPosition(e: Equipment, port: Port): { x: number; y: number } {
  const dx = port.u * e.footprint.width;
  const dy = port.v * e.footprint.length;
  const [sin, cos] = sinCos(e.rotation);
  return { x: e.position.x + dx * cos - dy * sin, y: e.position.y + dx * sin + dy * cos };
}

export function compile(p: Project): { line?: CompiledLine; issues: ModelIssue[] } {
  const issues: ModelIssue[] = [];
  const error = (code: string, message: string, objectId?: string) =>
    issues.push({ code, message, objectId, severity: 'error' });

  const byId = new Map(p.equipment.map((e) => [e.id, e]));
  const sources = p.equipment.filter((e) => e.behavior === 'source');
  const hasSink = p.equipment.some((e) => e.behavior === 'sink');

  if (p.products.length === 0) error('no_products', 'Add at least one product to simulate.');
  if (sources.length === 0) error('no_source', 'Add a source where parts are released.');
  for (const extra of sources.slice(1))
    error(
      'multiple_sources',
      `Only one source is supported; remove "${extra.name || extra.id}".`,
      extra.id,
    );
  if (!hasSink) error('no_sink', 'Add a sink where finished parts leave the line.');

  const staffed = new Set(p.technicians.flatMap((t) => t.stationIds));
  // Product owner decision (SE-6): only stations some routing uses need a technician.
  const routed = new Set(p.products.flatMap((pr) => pr.routing.flatMap(candidatesOf)));
  const stations: StationDef[] = [];
  /** perBatch stations take no cycleTimes, so their steps can't miss one. */
  const perBatch = new Set<string>();
  for (const e of p.equipment) {
    if (e.behavior !== 'workstation') continue;
    if (e.params.labor.mode === 'manual' && routed.has(e.id) && !staffed.has(e.id))
      error(
        'manual_station_without_tech',
        `"${e.name || e.id}" is manual but no technician is assigned to it.`,
        e.id,
      );
    const { cycle, maxWait } = e.params;
    const cure = cycle?.mode === 'perBatch' ? cycle.time : undefined;
    if (cure) perBatch.add(e.id);
    stations.push({
      id: e.id,
      capacity: e.params.capacity,
      batchSize: e.params.batchSize,
      labor: e.params.labor,
      position: e.position,
      techIds: p.technicians.filter((t) => t.stationIds.includes(e.id)).map((t) => t.id),
      ...(cure && { cure }),
      ...(maxWait !== undefined && { maxWait }),
      batches: e.params.batchSize > 1 || cure !== undefined,
    });
  }

  const connections = new Map<string, ConnectionDef>();
  const outgoing = new Map<string, { def: ConnectionDef; to: string }[]>();
  for (const c of p.connections) {
    const def: ConnectionDef = {
      id: c.id,
      capacity: c.capacity ?? Infinity,
      transfer:
        c.transfer.kind === 'speed'
          ? { kind: 'seconds', value: distance(byId, c.from, c.to) / c.transfer.speed }
          : c.transfer,
    };
    connections.set(c.id, def);
    const list = outgoing.get(c.from.equipmentId) ?? [];
    list.push({ def, to: c.to.equipmentId });
    outgoing.set(c.from.equipmentId, list);
  }

  const node = (e: Equipment): NodeDef => {
    switch (e.behavior) {
      case 'buffer':
        return { kind: 'buffer', id: e.id, capacity: e.params.capacity };
      case 'conveyor':
        return { kind: 'conveyor', id: e.id, travel: e.footprint.length / e.params.speed };
      case 'sink':
        return { kind: 'sink', id: e.id };
      default:
        return { kind: 'station', id: e.id };
    }
  };

  /**
   * Shortest path (fewest hops, then connection order) from `from` to a node accepted by
   * `isTarget`, passing only through buffers and conveyors: a part never crosses a
   * workstation that isn't its next step.
   */
  const findPath = (from: string, isTarget: (e: Equipment) => boolean): Leg[] | undefined => {
    const cameFrom = new Map<string, { prev: string; def: ConnectionDef }>();
    const queue = [from];
    for (let i = 0; i < queue.length; i++) {
      const at = queue[i]!;
      for (const { def, to } of outgoing.get(at) ?? []) {
        if (cameFrom.has(to) || to === from) continue;
        const e = byId.get(to)!;
        cameFrom.set(to, { prev: at, def });
        if (isTarget(e)) {
          const legs: Leg[] = [];
          for (let n = to; n !== from;) {
            const step = cameFrom.get(n)!;
            legs.unshift({ connection: step.def, node: node(byId.get(n)!) });
            n = step.prev;
          }
          return legs;
        }
        if (e.behavior === 'buffer' || e.behavior === 'conveyor') queue.push(to);
      }
    }
    return undefined;
  };

  const cycleTimes = new Map(p.cycleTimes.map((c) => [`${c.productId}\n${c.stationId}`, c.time]));
  const name = (id: string) => `"${byId.get(id)?.name || id}"`;
  const products: ProductDef[] = [];
  for (const product of p.products) {
    if (product.routing.length === 0) {
      error('no_routing', `${product.name} has no routing: add its steps.`, product.id);
      continue; // nothing to path-check
    }
    const steps: StepDef[] = [];
    /** Where parts start this step; undefined once a path is missing (one step's report is enough). */
    let froms: string[] | undefined = sources[0] && [sources[0].id];
    for (const step of product.routing) {
      const candidates = candidatesOf(step);
      for (const id of candidates)
        if (!cycleTimes.has(`${product.id}\n${id}`) && !perBatch.has(id))
          error('missing_cycle_time', `${product.name} has no cycle time at ${name(id)}.`, step.id);
      if (froms === undefined) continue;
      const from = new Map<string, OptionDef[]>();
      let reached = true;
      for (const at of froms) {
        const options: OptionDef[] = [];
        for (const id of candidates) {
          const legs = findPath(at, (e) => e.id === id);
          if (!legs) {
            error(
              'no_path',
              `${product.name} can't reach ${name(id)} from ${name(at)}: connect them.`,
              step.id,
            );
            reached = false;
            continue;
          }
          const cycle = cycleTimes.get(`${product.id}\n${id}`);
          options.push({ stationId: id, legs, ...(cycle && { cycle }) });
        }
        from.set(at, options);
      }
      steps.push({ from });
      froms = reached ? candidates : undefined;
    }
    if (froms !== undefined && hasSink) {
      const from = new Map<string, OptionDef[]>();
      for (const at of froms) {
        const legs = findPath(at, (e) => e.behavior === 'sink');
        if (legs) from.set(at, [{ legs }]);
        else
          error(
            'no_path',
            `${product.name} can't reach a sink from ${name(at)} after its last step.`,
            product.routing.at(-1)!.id,
          );
      }
      steps.push({ from });
    }
    products.push({ id: product.id, steps });
  }

  if (issues.length > 0) return { issues };

  const demand = new Map(p.demand.items.map((d) => [d.productId, d.value]));
  let weights = products.map((pr) => demand.get(pr.id) ?? 0);
  if (weights.every((w) => w === 0)) weights = products.map(() => 1);

  return {
    issues,
    line: {
      sourceId: sources[0]!.id,
      stations,
      techs: p.technicians.map((t) => ({
        id: t.id,
        walkSpeed: t.walkSpeed,
        home: t.stationIds[0],
      })),
      products,
      release: p.release,
      weights,
    },
  };
}

/** A step's stations in listed order: `stationId`, then its alternates (ADR-0018). */
function candidatesOf(step: Project['products'][number]['routing'][number]): string[] {
  return [step.stationId, ...(step.alternates ?? [])];
}

function distance(
  byId: Map<string, Equipment>,
  from: { equipmentId: string; portId: string },
  to: { equipmentId: string; portId: string },
): number {
  const at = (ref: typeof from) => {
    const e = byId.get(ref.equipmentId)!;
    return portPosition(
      e,
      e.ports.find((pt) => pt.id === ref.portId)!,
    );
  };
  const a = at(from);
  const b = at(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}
