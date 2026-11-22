import { z } from 'zod';

/**
 * Equipment types are data, not code (ADR-0010): one of five base behaviors plus its
 * parameters, footprint, height and appearance. Types live in a library shared across
 * projects (EQ-1 built-ins, EQ-3 user types). A placed instance copies its type's
 * settings and then owns them, so editing a type never silently changes a project.
 *
 * Ports (v3) are the input/output points connections attach to (FL-1, EQ-4).
 */

export const idSchema = z.string().min(1);
/** Meters, strictly positive. */
export const metersSchema = z.number().positive();
export const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Expected a color like #3b82f6');
const positiveInt = z.number().int().positive();

export const EQUIPMENT_BEHAVIORS = ['workstation', 'buffer', 'conveyor', 'source', 'sink'] as const;

/** Simulation parameters per behavior. SI units. */
export const behaviorParamsSchemas = {
  workstation: z
    .strictObject({
      /** Units processed at the same time (WS-3). */
      capacity: positiveInt,
      /** Units that must accumulate before processing starts (WS-3); processed together. */
      batchSize: positiveInt,
    })
    .refine((p) => p.batchSize <= p.capacity, {
      message: 'Batch size cannot exceed capacity: a batch is processed together',
      path: ['batchSize'],
    }),
  buffer: z.strictObject({
    /** Maximum units held. */
    capacity: positiveInt,
  }),
  conveyor: z.strictObject({
    /**
     * Belt speed in m/s. Until input/output points exist (EQ-4), travel distance is the
     * footprint length; afterwards the engine derives it from the points.
     */
    speed: z.number().positive(),
  }),
  source: z.strictObject({}),
  sink: z.strictObject({}),
} as const;

/** `behavior` + matching `params`, shared by types and instances. */
function withBehavior<S extends z.core.$ZodLooseShape>(shape: S) {
  return z.discriminatedUnion('behavior', [
    z.strictObject({
      ...shape,
      behavior: z.literal('workstation'),
      params: behaviorParamsSchemas.workstation,
    }),
    z.strictObject({
      ...shape,
      behavior: z.literal('buffer'),
      params: behaviorParamsSchemas.buffer,
    }),
    z.strictObject({
      ...shape,
      behavior: z.literal('conveyor'),
      params: behaviorParamsSchemas.conveyor,
    }),
    z.strictObject({
      ...shape,
      behavior: z.literal('source'),
      params: behaviorParamsSchemas.source,
    }),
    z.strictObject({ ...shape, behavior: z.literal('sink'), params: behaviorParamsSchemas.sink }),
  ]);
}

export const footprintSchema = z.strictObject({ width: metersSchema, length: metersSchema });

/**
 * A connection point on the footprint (FL-1, EQ-4). `u`/`v` are fractions of the footprint
 * in the equipment's own frame (−0.5…0.5 across `width` and along `length`), so ports stay
 * on the footprint when it is resized (EQ-2). Rotation and position come from the instance.
 */
export const portSchema = z.strictObject({
  id: idSchema,
  kind: z.enum(['input', 'output']),
  u: z.number().min(-0.5).max(0.5),
  v: z.number().min(-0.5).max(0.5),
});

/** What each behavior needs: sources only emit, sinks only absorb, the rest do both. */
const PORT_RULES: Record<string, { input: 'none' | 'some'; output: 'none' | 'some' }> = {
  source: { input: 'none', output: 'some' },
  sink: { input: 'some', output: 'none' },
  workstation: { input: 'some', output: 'some' },
  buffer: { input: 'some', output: 'some' },
  conveyor: { input: 'some', output: 'some' },
};

function checkPorts(
  e: { behavior: string; ports: { id: string; kind: 'input' | 'output' }[] },
  ctx: z.RefinementCtx,
): void {
  const seen = new Set<string>();
  e.ports.forEach((port, i) => {
    if (seen.has(port.id))
      ctx.addIssue({
        code: 'custom',
        path: ['ports', i, 'id'],
        message: `Duplicate port id "${port.id}"`,
      });
    seen.add(port.id);
  });
  const rule = PORT_RULES[e.behavior];
  if (!rule) return;
  for (const kind of ['input', 'output'] as const) {
    const count = e.ports.filter((p) => p.kind === kind).length;
    if (rule[kind] === 'none' && count > 0)
      ctx.addIssue({
        code: 'custom',
        path: ['ports'],
        message: `A ${e.behavior} has no ${kind} ports`,
      });
    if (rule[kind] === 'some' && count === 0)
      ctx.addIssue({
        code: 'custom',
        path: ['ports'],
        message: `A ${e.behavior} needs at least one ${kind} port`,
      });
  }
}

/**
 * Default ports (EQ-4): material flows along the footprint's length, entering at one end
 * and leaving at the other.
 */
export function defaultPorts(behavior: string): z.infer<typeof portSchema>[] {
  const input = { id: 'in', kind: 'input' as const, u: 0, v: -0.5 };
  const output = { id: 'out', kind: 'output' as const, u: 0, v: 0.5 };
  if (behavior === 'source') return [output];
  if (behavior === 'sink') return [input];
  return [input, output];
}

/** The settings a type defines and an instance copies. */
const typeSettings = {
  footprint: footprintSchema,
  height: metersSchema,
  color: colorSchema,
  ports: z.array(portSchema),
};

/** A library entry (EQ-1 built-in or EQ-3 user-defined). */
export const equipmentTypeSchema = withBehavior({
  id: idSchema,
  name: z.string().trim().min(1),
  ...typeSettings,
}).superRefine(checkPorts);

/** Floor-plan coordinates in meters; the renderer maps y onto its ground axis. */
export const pointSchema = z.strictObject({ x: z.number(), y: z.number() });

/** An instance placed on the floor, with its own copy of the type's settings. */
export const equipmentSchema = withBehavior({
  id: idSchema,
  name: z.string(),
  /** The library type it was created from; used to offer "update instances" (EQ-3). */
  typeId: idSchema,
  position: pointSchema,
  /** Radians about the vertical axis. */
  rotation: z.number(),
  ...typeSettings,
}).superRefine(checkPorts);

export type EquipmentType = z.infer<typeof equipmentTypeSchema>;
export type Equipment = z.infer<typeof equipmentSchema>;
export type EquipmentBehavior = Equipment['behavior'];
export type Port = z.infer<typeof portSchema>;
export type BehaviorParams<B extends EquipmentBehavior> = z.infer<
  (typeof behaviorParamsSchemas)[B]
>;

/**
 * The five built-in types (EQ-1). Defaults are typical sizes, editable per instance (EQ-2).
 * Colors are neutral so they don't clash with product colors or station-state colors.
 */
export const BASE_EQUIPMENT_TYPES: readonly EquipmentType[] = [
  {
    id: 'base-workstation',
    name: 'Workstation',
    behavior: 'workstation',
    params: { capacity: 1, batchSize: 1 },
    footprint: { width: 2, length: 1.5 },
    height: 1.2,
    color: '#8a94a6',
    ports: defaultPorts('workstation'),
  },
  {
    id: 'base-buffer',
    name: 'Buffer / rack',
    behavior: 'buffer',
    params: { capacity: 10 },
    footprint: { width: 1.2, length: 1 },
    height: 2,
    color: '#a68a64',
    ports: defaultPorts('buffer'),
  },
  {
    id: 'base-conveyor',
    name: 'Conveyor',
    behavior: 'conveyor',
    params: { speed: 0.2 },
    footprint: { width: 0.6, length: 3 },
    height: 0.9,
    color: '#5f6b7a',
    ports: defaultPorts('conveyor'),
  },
  {
    id: 'base-source',
    name: 'Source (material release)',
    behavior: 'source',
    params: {},
    footprint: { width: 1, length: 1 },
    height: 1,
    color: '#6b7f99',
    ports: defaultPorts('source'),
  },
  {
    id: 'base-sink',
    name: 'Sink (shipping)',
    behavior: 'sink',
    params: {},
    footprint: { width: 1, length: 1 },
    height: 1,
    color: '#7a6b99',
    ports: defaultPorts('sink'),
  },
];

export interface Placement {
  id: string;
  position: { x: number; y: number };
  /** Radians; default 0. */
  rotation?: number;
  /** Default: the type's name. */
  name?: string;
}

/** Places a type on the floor: the instance gets its own copy of every setting. */
export function instantiate(type: EquipmentType, placement: Placement): Equipment {
  const { id: typeId, name, ...settings } = structuredCopy(type);
  return {
    ...settings,
    id: placement.id,
    name: placement.name ?? name,
    typeId,
    position: { ...placement.position },
    rotation: placement.rotation ?? 0,
  } as Equipment; // the spread keeps behavior and params paired; TS can't see through it
}

/** Plain-JSON deep copy; types are JSON data. */
function structuredCopy<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}
