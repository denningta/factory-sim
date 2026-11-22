import { z } from 'zod';

/**
 * Project document, schema version 1 (ADR-0006, ADR-0009, ADR-0010).
 * All lengths are meters, all times seconds, angles radians. Display units are a UI
 * concern and are never stored here.
 *
 * Project metadata (id, name, owner, timestamps) lives in relational columns
 * (ADR-0004); this document is the editable content only.
 */
export const CURRENT_SCHEMA_VERSION = 1;

const id = z.string().min(1);
/** Meters, strictly positive. */
const meters = z.number().positive();
/** Seconds, strictly positive. */
const seconds = z.number().positive();

export const EQUIPMENT_BEHAVIORS = ['workstation', 'buffer', 'conveyor', 'source', 'sink'] as const;

export const floorSchema = z.strictObject({
  width: meters,
  length: meters,
  gridSpacing: meters,
});

/** Floor-plan coordinates in meters; the renderer maps y onto its ground axis. */
const pointSchema = z.strictObject({ x: z.number(), y: z.number() });

/** An instance placed on the floor. It copies its type's settings (ADR-0010). */
export const equipmentSchema = z.strictObject({
  id,
  name: z.string(),
  typeId: id,
  behavior: z.enum(EQUIPMENT_BEHAVIORS),
  position: pointSchema,
  /** Radians about the vertical axis. */
  rotation: z.number(),
  footprint: z.strictObject({ width: meters, length: meters }),
  height: meters,
});

/** Directed material flow from one piece of equipment to another. */
export const connectionSchema = z.strictObject({ id, from: id, to: id });

export const routingStepSchema = z.strictObject({ id, stationId: id });

export const productSchema = z.strictObject({
  id,
  partNumber: z.string().trim().min(1),
  name: z.string().min(1),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected a color like #3b82f6'),
  /** Ordered operations; each step points at a workstation. */
  routing: z.array(routingStepSchema),
});

/**
 * A duration in seconds. A discriminated union so that random distributions (PR-4)
 * can be added as new kinds without a schema version bump.
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

  p.connections.forEach((c, i) => {
    if (c.from === c.to)
      issue(['connections', i], `A connection cannot connect "${c.from}" to itself`);
    if (!equipment.has(c.from)) issue(['connections', i, 'from'], `Unknown equipment "${c.from}"`);
    if (!equipment.has(c.to)) issue(['connections', i, 'to'], `Unknown equipment "${c.to}"`);
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
export type Equipment = Project['equipment'][number];
export type EquipmentBehavior = Equipment['behavior'];
export type Connection = Project['connections'][number];
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
