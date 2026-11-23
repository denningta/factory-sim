import { z } from 'zod';
import {
  colorSchema as color,
  equipmentSchema,
  idSchema as id,
  metersSchema as meters,
} from './equipment';

/**
 * Project document, schema version 3 (ADR-0006, ADR-0009, ADR-0010).
 * v2: equipment instances carry their own `color` and behavior `params` (EQ-1/EQ-3).
 * v3: equipment has `ports`; connections join an output port to an input port and carry a
 *     `capacity` (FL-1, FL-2).
 * All lengths are meters, all times seconds, angles radians. Display units are a UI
 * concern and are never stored here.
 *
 * Project metadata (id, name, owner, timestamps) lives in relational columns
 * (ADR-0004); this document is the editable content only.
 */
export const CURRENT_SCHEMA_VERSION = 3;

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
});

export const routingStepSchema = z.strictObject({ id, stationId: id });

export const productSchema = z.strictObject({
  id,
  /** Surrounding whitespace is trimmed so " A-100" and "A-100" count as the same part. */
  partNumber: z.string().trim().min(1),
  name: z.string().min(1),
  color,
  /** Ordered operations; each step points at a workstation. */
  routing: z.array(routingStepSchema),
});

/**
 * A duration in seconds. A discriminated union so that random distributions (PR-4)
 * are new kinds with a trivial upgrade step, not a reshaping of existing data.
 */
export const durationSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('fixed'), value: seconds }),
]);

/** Cycle time keyed by (product, station) (ADR-0009). */
export const cycleTimeSchema = z.strictObject({
  productId: id,
  stationId: id,
  time: durationSchema,
});

const projectShape = z.strictObject({
  schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
  floor: floorSchema,
  equipment: z.array(equipmentSchema),
  connections: z.array(connectionSchema),
  products: z.array(productSchema),
  cycleTimes: z.array(cycleTimeSchema),
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

export const projectSchema = projectShape.superRefine(checkReferences);

export type Project = z.infer<typeof projectSchema>;
export type Floor = Project['floor'];
export type Connection = Project['connections'][number];
export type PortRef = Connection['from'];
export type Product = Project['products'][number];
export type RoutingStep = Product['routing'][number];
export type Duration = z.infer<typeof durationSchema>;
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
  };
}
