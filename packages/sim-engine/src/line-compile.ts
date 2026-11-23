/**
 * `compileLine` (SE-6): checks a project for problems that block a run (`ModelIssue`s) and
 * turns it into plain, precomputed data for `line-run.ts`. Everything that doesn't depend
 * on the seed (routes, distances, release weights) is done here, once.
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
  /** For a routing step's station: the cycle time. */
  cycle?: Duration;
}

export interface ProductDef {
  id: string;
  route: Leg[];
}

export interface StationDef {
  id: string;
  capacity: number;
  batchSize: number;
  labor: Labor;
  position: { x: number; y: number };
  /** Technicians assigned to it, in document order. */
  techIds: string[];
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
  const stations: StationDef[] = [];
  for (const e of p.equipment) {
    if (e.behavior !== 'workstation') continue;
    if (e.params.labor.mode === 'manual' && !staffed.has(e.id))
      error(
        'manual_station_without_tech',
        `"${e.name || e.id}" is manual but no technician is assigned to it.`,
        e.id,
      );
    stations.push({
      id: e.id,
      capacity: e.params.capacity,
      batchSize: e.params.batchSize,
      labor: e.params.labor,
      position: e.position,
      techIds: p.technicians.filter((t) => t.stationIds.includes(e.id)).map((t) => t.id),
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
  const products: ProductDef[] = [];
  for (const product of p.products) {
    const route: Leg[] = [];
    let at = sources[0]?.id;
    for (const step of product.routing) {
      const cycle = cycleTimes.get(`${product.id}\n${step.stationId}`);
      if (!cycle)
        error(
          'missing_cycle_time',
          `${product.name} has no cycle time at "${byId.get(step.stationId)?.name || step.stationId}".`,
          step.id,
        );
      if (at === undefined) continue;
      const legs = findPath(at, (e) => e.id === step.stationId);
      if (!legs) {
        error(
          'no_path',
          `${product.name} can't reach "${byId.get(step.stationId)?.name || step.stationId}": connect it from the previous step.`,
          step.id,
        );
        at = undefined; // one missing path per product is enough to report
        continue;
      }
      legs[legs.length - 1]!.cycle = cycle;
      route.push(...legs);
      at = step.stationId;
    }
    if (at !== undefined && hasSink) {
      const legs = findPath(at, (e) => e.behavior === 'sink');
      if (legs) route.push(...legs);
      else
        error(
          'no_path',
          `${product.name} can't reach a sink after its last step.`,
          product.routing.at(-1)?.id ?? product.id,
        );
    }
    products.push({ id: product.id, route });
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
