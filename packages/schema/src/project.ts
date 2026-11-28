import { z } from 'zod';
import { durationSchema } from './duration';
import {
  colorSchema as color,
  equipmentSchema,
  idSchema as id,
  metersSchema as meters,
} from './equipment';

/**
 * Project document, schema version 7 (ADR-0006, ADR-0009, ADR-0010).
 * v2: equipment instances carry their own `color` and behavior `params` (EQ-1/EQ-3).
 * v3: equipment has `ports`; connections join an output port to an input port and carry a
 *     `capacity` (FL-1, FL-2).
 * v4: duration distributions (WS-2), routing step names, calendar, demand and release rule
 *     (PR-4), technicians and workstation labor (TE-1), connection transfer time (FL-4).
 * v5: saved run settings (SE-4): warm-up, run length and seed.
 * v6: layout checks (LE-5): optional minimum clearance between equipment.
 * v7: equipment may name its 3D `model` (ADR-0015); optional, so v6 documents are valid as is.
 * All lengths are meters, all times seconds, angles radians. Display units are a UI
 * concern and are never stored here.
 *
 * Project metadata (id, name, owner, timestamps) lives in relational columns
 * (ADR-0004); this document is the editable content only.
 */
export const CURRENT_SCHEMA_VERSION = 8;

/** Seconds, strictly positive. */
const seconds = z.number().positive();

export const floorSchema = z.strictObject({
  width: meters,
  length: meters,
  gridSpacing: meters,
});

const portRefSchema = z.strictObject({ equipmentId: id, portId: id });

/** Directed material flow from an output port to an input port (FL-1). */
export const connectionSchema = z.strictObject({
  id,
  from: portRefSchema,
  to: portRefSchema,
  /**
   * Parts that can wait on this connection (FL-2): 0 = no buffer (direct hand-off; the
   * upstream station blocks until downstream takes the part), `null` = unlimited.
   */
  capacity: z.number().int().nonnegative().nullable(),
  /**
   * Time to move a part along the connection (FL-4): `instant`, a `fixed` duration, or
   * calculated from the distance between the two ports at `speed` m/s. Parts in transit
   * count as WIP.
   */
  transfer: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('instant') }),
    z.strictObject({ kind: z.literal('fixed'), time: durationSchema }),
    z.strictObject({ kind: z.literal('speed'), speed: z.number().positive() }),
  ]),
});

export const routingStepSchema = z.strictObject({
  id,
  stationId: id,
  /** Optional operation name shown in the routing (e.g. "Cut stock"). */
  name: z.string().trim().max(100).optional(),
  /**
   * Other workstations that can do this step in parallel (ADR-0018): the part goes to
   * `stationId` or any alternate, whichever has room first. Absent = this station only.
   */
  alternates: z.array(id).optional(),
});

export const productSchema = z.strictObject({
  id,
  /** Surrounding whitespace is trimmed so " A-100" and "A-100" count as the same part. */
  partNumber: z.string().trim().min(1),
  name: z.string().min(1),
  color,
  /** Ordered operations; each step points at a workstation. */
  routing: z.array(routingStepSchema),
});

export { durationSchema };

/** Cycle time keyed by (product, station) (ADR-0009). */
export const cycleTimeSchema = z.strictObject({
  productId: id,
  stationId: id,
  time: durationSchema,
});

/** Working calendar. Shift length turns "per shift" demand and run lengths into seconds. */
export const calendarSchema = z.strictObject({ shiftLength: seconds });

/**
 * Demand (PR-4): units per shift, or percent of the mix, per product. With `mix`, values
 * sum to 100.
 */
export const demandSchema = z
  .strictObject({
    basis: z.enum(['perShift', 'mix']),
    items: z.array(z.strictObject({ productId: id, value: z.number().nonnegative() })),
  })
  .refine(
    (d) =>
      d.basis !== 'mix' ||
      d.items.length === 0 ||
      Math.abs(d.items.reduce((sum, i) => sum + i.value, 0) - 100) <= 0.05, // 3 × 33.33 is fine
    { message: 'Mix percentages must add up to 100', path: ['items'] },
  );

/**
 * Release rule (PR-4): one part every `interval` (fixed or a distribution). Which product:
 * `smooth` follows the demand mix deterministically (fixed-interval option), `random` draws
 * by mix (random-by-mix option), `sequence` repeats a heijunka pattern of product ids.
 */
export const releaseSchema = z.strictObject({
  interval: durationSchema,
  product: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('smooth') }),
    z.strictObject({ kind: z.literal('random') }),
    z.strictObject({ kind: z.literal('sequence'), pattern: z.array(id).min(1) }),
  ]),
});

/**
 * Layout checks (LE-5). `minClearance` in meters: equipment closer than this is flagged;
 * `null` turns the clearance check off (overlaps are always flagged).
 */
export const layoutSettingsSchema = z.strictObject({
  minClearance: z.number().positive().nullable(),
});

/** The engine's PRNG takes a 32-bit seed (rng.ts reduces larger values modulo 2^32). */
export const MAX_SEED = 2 ** 32 - 1;

/**
 * Run settings (SE-4), saved with the project. `warmUp` is in seconds and excluded from
 * statistics. Run length is seconds, or shifts of `calendar.shiftLength`, so a shift-based
 * run follows a later shift-length change. With `random`, a new seed is drawn per run and
 * `value` keeps the last fixed seed for when the user switches back.
 */
export const runSettingsSchema = z.strictObject({
  warmUp: z.number().nonnegative(),
  length: z.discriminatedUnion('unit', [
    z.strictObject({ unit: z.literal('seconds'), value: seconds }),
    z.strictObject({ unit: z.literal('shifts'), value: z.number().positive() }),
  ]),
  seed: z.strictObject({
    mode: z.enum(['fixed', 'random']),
    value: z.number().int().min(0).max(MAX_SEED),
  }),
});

/** A technician (TE-1) assigned to one or more workstations. */
export const technicianSchema = z.strictObject({
  id,
  name: z.string().trim().min(1),
  /** m/s; default 1.2. */
  walkSpeed: z.number().positive(),
  stationIds: z.array(id),
});

const projectShape = z.strictObject({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  floor: floorSchema,
  equipment: z.array(equipmentSchema),
  connections: z.array(connectionSchema),
  products: z.array(productSchema),
  cycleTimes: z.array(cycleTimeSchema),
  calendar: calendarSchema,
  demand: demandSchema,
  release: releaseSchema,
  technicians: z.array(technicianSchema),
  run: runSettingsSchema,
  layout: layoutSettingsSchema,
});

type ProjectShape = z.infer<typeof projectShape>;

/** Cross-reference rules that a field-level schema can't express. */
function checkReferences(p: ProjectShape, ctx: z.RefinementCtx): void {
  const issue = (path: PropertyKey[], message: string) =>
    ctx.addIssue({ code: 'custom', path, message });

  const seenIds = new Set<string>();
  const claimId = (value: string, path: PropertyKey[]) => {
    if (seenIds.has(value)) issue(path, `Duplicate id "${value}"`);
    seenIds.add(value);
  };
  p.equipment.forEach((e, i) => claimId(e.id, ['equipment', i, 'id']));
  p.connections.forEach((c, i) => claimId(c.id, ['connections', i, 'id']));
  p.products.forEach((pr, i) => {
    claimId(pr.id, ['products', i, 'id']);
    pr.routing.forEach((s, j) => claimId(s.id, ['products', i, 'routing', j, 'id']));
  });

  const equipment = new Map(p.equipment.map((e) => [e.id, e]));
  const checkStation = (stationId: string, path: PropertyKey[]) => {
    const station = equipment.get(stationId);
    if (!station) issue(path, `Unknown equipment "${stationId}"`);
    else if (station.behavior !== 'workstation')
      issue(path, `Equipment "${stationId}" is a ${station.behavior}, not a workstation`);
  };

  const linked = new Set<string>();
  p.connections.forEach((c, i) => {
    if (c.from.equipmentId === c.to.equipmentId)
      issue(['connections', i], `A connection cannot connect "${c.from.equipmentId}" to itself`);
    for (const [end, kind] of [
      ['from', 'output'],
      ['to', 'input'],
    ] as const) {
      const ref = c[end];
      const e = equipment.get(ref.equipmentId);
      if (!e) {
        issue(['connections', i, end, 'equipmentId'], `Unknown equipment "${ref.equipmentId}"`);
        continue;
      }
      const port = e.ports.find((pt) => pt.id === ref.portId);
      if (!port)
        issue(
          ['connections', i, end, 'portId'],
          `"${ref.equipmentId}" has no port "${ref.portId}"`,
        );
      else if (port.kind !== kind)
        issue(
          ['connections', i, end, 'portId'],
          `Port "${ref.portId}" on "${ref.equipmentId}" is an ${port.kind}, expected an ${kind}`,
        );
    }
    const key = JSON.stringify([c.from, c.to]);
    if (linked.has(key)) issue(['connections', i], 'These two ports are already connected');
    linked.add(key);
  });

  const partNumbers = new Set<string>();
  p.products.forEach((pr, i) => {
    if (partNumbers.has(pr.partNumber))
      issue(['products', i, 'partNumber'], `Part number "${pr.partNumber}" is already used`);
    partNumbers.add(pr.partNumber);
    pr.routing.forEach((s, j) =>
      checkStation(s.stationId, ['products', i, 'routing', j, 'stationId']),
    );
  });

  const productIds = new Set(p.products.map((pr) => pr.id));
  const cycleKeys = new Set<string>();
  p.cycleTimes.forEach((ct, i) => {
    if (!productIds.has(ct.productId))
      issue(['cycleTimes', i, 'productId'], `Unknown product "${ct.productId}"`);
    checkStation(ct.stationId, ['cycleTimes', i, 'stationId']);
    const key = JSON.stringify([ct.productId, ct.stationId]);
    if (cycleKeys.has(key))
      issue(
        ['cycleTimes', i],
        `Product "${ct.productId}" already has a cycle time at station "${ct.stationId}"`,
      );
    cycleKeys.add(key);
  });
}

function checkPlanning(p: ProjectShape, ctx: z.RefinementCtx): void {
  const issue = (path: PropertyKey[], message: string) =>
    ctx.addIssue({ code: 'custom', path, message });
  const productIds = new Set(p.products.map((pr) => pr.id));
  const workstations = new Set(
    p.equipment.filter((e) => e.behavior === 'workstation').map((e) => e.id),
  );

  const demanded = new Set<string>();
  p.demand.items.forEach((item, i) => {
    if (!productIds.has(item.productId))
      issue(['demand', 'items', i, 'productId'], `Unknown product "${item.productId}"`);
    if (demanded.has(item.productId))
      issue(['demand', 'items', i, 'productId'], `Product "${item.productId}" is listed twice`);
    demanded.add(item.productId);
  });

  if (p.release.product.kind === 'sequence')
    p.release.product.pattern.forEach((productId, i) => {
      if (!productIds.has(productId))
        issue(['release', 'product', 'pattern', i], `Unknown product "${productId}"`);
    });

  const seenTechIds = new Set(p.equipment.map((e) => e.id));
  p.technicians.forEach((t, i) => {
    if (seenTechIds.has(t.id)) issue(['technicians', i, 'id'], `Duplicate id "${t.id}"`);
    seenTechIds.add(t.id);
    const assigned = new Set<string>();
    t.stationIds.forEach((stationId, j) => {
      if (!workstations.has(stationId))
        issue(['technicians', i, 'stationIds', j], `"${stationId}" is not a workstation`);
      if (assigned.has(stationId))
        issue(['technicians', i, 'stationIds', j], `"${stationId}" is assigned twice`);
      assigned.add(stationId);
    });
  });
}

export const projectSchema = projectShape.superRefine(checkReferences).superRefine(checkPlanning);

export type Project = z.infer<typeof projectSchema>;
export type Floor = Project['floor'];
export type Connection = Project['connections'][number];
export type PortRef = Connection['from'];
export type Product = Project['products'][number];
export type RoutingStep = Product['routing'][number];
export type Calendar = Project['calendar'];
export type Demand = Project['demand'];
export type Release = Project['release'];
export type Technician = Project['technicians'][number];
export type RunSettings = Project['run'];
export type LayoutSettings = Project['layout'];
export type Transfer = Connection['transfer'];
export type CycleTime = Project['cycleTimes'][number];

/** An empty project with a default 30 m × 20 m floor and a 1 m grid. */
export function createProject(): Project {
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    floor: { width: 30, length: 20, gridSpacing: 1 },
    equipment: [],
    connections: [],
    products: [],
    cycleTimes: [],
    calendar: { shiftLength: 8 * 3600 },
    demand: { basis: 'mix', items: [] },
    release: { interval: { kind: 'fixed', value: 60 }, product: { kind: 'smooth' } },
    technicians: [],
    run: { warmUp: 0, length: { unit: 'shifts', value: 1 }, seed: { mode: 'fixed', value: 1 } },
    layout: { minClearance: null },
  };
}
