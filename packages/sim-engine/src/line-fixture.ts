/**
 * Builds small, valid project documents for the line-model tests: a straight line
 * source → S1 → … → Sn → sink along x, one connection between each neighbour.
 * Test-only helper (not exported from the package).
 */
import {
  BASE_EQUIPMENT_TYPES,
  createProject,
  instantiate,
  type Connection,
  type Duration,
  type Equipment,
  type Labor,
  type Project,
} from '@factory-sim/schema';

export interface StationSpec {
  id: string;
  /** Cycle time per product id; products without an entry aren't routed here. */
  cycle: Record<string, Duration>;
  capacity?: number;
  batchSize?: number;
  labor?: Labor;
  /**
   * SF-6: `cycle.mode = 'perBatch'` with this cure time. The station then gets no
   * `cycleTimes` entries; `cycle` only says which products are routed here.
   */
  cure?: Duration;
  /** SF-6: start a partial batch after the first waiting part has waited this long (s). */
  maxWait?: number;
}

export interface LineSpec {
  products: string[];
  /** Between source/stations/sink: optional buffer or conveyor placed on the link. */
  stations: StationSpec[];
  /** Capacity of every connection; default null (unlimited). */
  linkCapacity?: number | null;
  /** Per link index (0 = source → first station), overrides `linkCapacity`. */
  links?: Record<number, Partial<Pick<Connection, 'capacity' | 'transfer'>>>;
  /** Insert a buffer (capacity) or conveyor (speed) after station index i (−1 = source). */
  inserts?: Record<number, { buffer: number } | { conveyorSpeed: number }>;
  interval?: Duration;
  release?: Project['release']['product'];
  demand?: Project['demand'];
  /** One technician per station by default (all walking 1.2 m/s); `false` for none. */
  techs?: Project['technicians'] | false;
  /** Distance between neighbours along x, meters. */
  spacing?: number;
}

const type = (behavior: string) => BASE_EQUIPMENT_TYPES.find((t) => t.behavior === behavior)!;

function place(behavior: string, id: string, x: number): Equipment {
  return instantiate(type(behavior), { id, position: { x, y: 0 }, rotation: -Math.PI / 2 });
}

export function lineProject(spec: LineSpec): Project {
  const p = createProject();
  const spacing = spec.spacing ?? 4;
  const chain: Equipment[] = [];
  let x = 0;
  const add = (e: Equipment) => {
    chain.push(e);
    x += spacing;
  };
  const insert = (i: number) => {
    const ins = spec.inserts?.[i];
    if (!ins) return;
    if ('buffer' in ins) {
      const b = place('buffer', `B${i + 1}`, x);
      if (b.behavior === 'buffer') b.params = { capacity: ins.buffer };
      add(b);
    } else {
      const c = place('conveyor', `C${i + 1}`, x);
      if (c.behavior === 'conveyor') c.params = { speed: ins.conveyorSpeed };
      add(c);
    }
  };
  add(place('source', 'src', x));
  insert(-1);
  spec.stations.forEach((s, i) => {
    const e = place('workstation', s.id, x);
    if (e.behavior === 'workstation')
      e.params = {
        capacity: s.capacity ?? 1,
        batchSize: s.batchSize ?? 1,
        labor: s.labor ?? { mode: 'manual' },
        ...(s.cure && { cycle: { mode: 'perBatch' as const, time: s.cure } }),
        ...(s.maxWait !== undefined && { maxWait: s.maxWait }),
      };
    add(e);
    insert(i);
  });
  add(place('sink', 'sink', x));
  p.equipment = chain;
  p.connections = chain.slice(1).map((to, i) => ({
    id: `L${i}`,
    from: { equipmentId: chain[i]!.id, portId: 'out' },
    to: { equipmentId: to.id, portId: 'in' },
    capacity: spec.linkCapacity === undefined ? null : spec.linkCapacity,
    transfer: { kind: 'instant' as const },
    ...spec.links?.[i],
  }));
  p.products = spec.products.map((id) => ({
    id,
    partNumber: `P-${id}`,
    name: id,
    color: '#336699',
    routing: spec.stations
      .filter((s) => s.cycle[id])
      .map((s) => ({ id: `${id}-${s.id}`, stationId: s.id })),
  }));
  p.cycleTimes = spec.stations.flatMap((s) =>
    s.cure
      ? []
      : Object.entries(s.cycle).map(([productId, time]) => ({ productId, stationId: s.id, time })),
  );
  p.release = {
    interval: spec.interval ?? { kind: 'fixed', value: 60 },
    product: spec.release ?? { kind: 'smooth' },
  };
  if (spec.demand) p.demand = spec.demand;
  p.technicians =
    spec.techs === false
      ? []
      : (spec.techs ??
        spec.stations.map((s) => ({
          id: `T-${s.id}`,
          name: `Tech ${s.id}`,
          walkSpeed: 1.2,
          stationIds: [s.id],
        })));
  return p;
}

export const fixed = (value: number): Duration => ({ kind: 'fixed', value });
