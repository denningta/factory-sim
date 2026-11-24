/**
 * Versioned project document schema (ADR-0006). One schema for web and API.
 *
 * - `validateProject` on save: the document must already be the current version.
 * - `loadProject` on open: upgrades older documents, then validates.
 *
 * Every schema change, additive ones included, bumps CURRENT_SCHEMA_VERSION and adds
 * `upgradeSteps[previousVersion]` (just setting the new version number for additive
 * changes) plus a test that upgrades a sample of the old version. The schema rejects
 * unknown keys, so the bump is what lets an older build say "saved by a newer version"
 * instead of failing on an unrecognized field.
 */
import { CURRENT_SCHEMA_VERSION, projectSchema, type Project } from './project';
import { createUpgrader, validate, type ParseResult, type UpgradeStep } from './upgrade';

export * from './equipment';
export * from './duration';
export * from './project';
export * from './http';
export { createUpgrader, formatIssues, type ParseResult, type UpgradeStep } from './upgrade';

/**
 * Keyed by the version each step upgrades from. Each step is a frozen snapshot: it
 * hard-codes the values of its time rather than reading live constants such as
 * BASE_EQUIPMENT_TYPES, so changing today's defaults never changes how old files upgrade.
 */
const upgradeSteps: Readonly<Record<number, UpgradeStep>> = {
  // v1 → v2: equipment instances get their own color and behavior params.
  1: (doc) => {
    const v1Defaults: Record<string, { color: string; params: Record<string, number> }> = {
      workstation: { color: '#8a94a6', params: { capacity: 1, batchSize: 1 } },
      buffer: { color: '#a68a64', params: { capacity: 10 } },
      conveyor: { color: '#5f6b7a', params: { speed: 0.2 } },
      source: { color: '#6b7f99', params: {} },
      sink: { color: '#7a6b99', params: {} },
    };
    // Only rewrite what this step understands; anything malformed is left for validation
    // to report, never silently "repaired" into valid but empty data.
    if (!Array.isArray(doc.equipment)) return { ...doc, schemaVersion: 2 };
    return {
      ...doc,
      schemaVersion: 2,
      equipment: doc.equipment.map((e: unknown) => {
        if (typeof e !== 'object' || e === null) return e;
        const behavior = (e as { behavior?: unknown }).behavior;
        const defaults =
          typeof behavior === 'string' && Object.hasOwn(v1Defaults, behavior)
            ? v1Defaults[behavior]
            : undefined;
        return defaults ? { ...defaults, ...e } : e;
      }),
    };
  },
  // v2 → v3: equipment gets default ports; connections join those ports, capacity 0.
  2: (doc) => {
    const v2Ports: Record<string, { id: string; kind: string; u: number; v: number }[]> = {
      source: [{ id: 'out', kind: 'output', u: 0, v: 0.5 }],
      sink: [{ id: 'in', kind: 'input', u: 0, v: -0.5 }],
      workstation: [
        { id: 'in', kind: 'input', u: 0, v: -0.5 },
        { id: 'out', kind: 'output', u: 0, v: 0.5 },
      ],
      buffer: [
        { id: 'in', kind: 'input', u: 0, v: -0.5 },
        { id: 'out', kind: 'output', u: 0, v: 0.5 },
      ],
      conveyor: [
        { id: 'in', kind: 'input', u: 0, v: -0.5 },
        { id: 'out', kind: 'output', u: 0, v: 0.5 },
      ],
    };
    const next: Record<string, unknown> = { ...doc, schemaVersion: 3 };
    if (Array.isArray(doc.equipment)) {
      next.equipment = doc.equipment.map((e: unknown) => {
        if (typeof e !== 'object' || e === null) return e;
        const behavior = (e as { behavior?: unknown }).behavior;
        const ports =
          typeof behavior === 'string' && Object.hasOwn(v2Ports, behavior)
            ? v2Ports[behavior]
            : undefined;
        return ports ? { ports, ...e } : e;
      });
    }
    if (Array.isArray(doc.connections)) {
      next.connections = doc.connections.map((c: unknown) => {
        if (typeof c !== 'object' || c === null) return c;
        const { from, to } = c as { from?: unknown; to?: unknown };
        if (typeof from !== 'string' || typeof to !== 'string') return c;
        return {
          ...c,
          from: { equipmentId: from, portId: 'out' },
          to: { equipmentId: to, portId: 'in' },
          capacity: 0,
        };
      });
    }
    return next;
  },
  // v3 → v4: planning defaults, manual labor on workstations, instant transfers.
  3: (doc) => {
    const next: Record<string, unknown> = {
      calendar: { shiftLength: 28800 },
      demand: { basis: 'mix', items: [] },
      release: { interval: { kind: 'fixed', value: 60 }, product: { kind: 'smooth' } },
      technicians: [],
      ...doc,
      schemaVersion: 4,
    };
    if (Array.isArray(doc.equipment)) {
      next.equipment = doc.equipment.map((e: unknown) => {
        if (typeof e !== 'object' || e === null) return e;
        const { behavior, params } = e as { behavior?: unknown; params?: unknown };
        if (behavior !== 'workstation' || typeof params !== 'object' || params === null) return e;
        return { ...e, params: { labor: { mode: 'manual' }, ...params } };
      });
    }
    if (Array.isArray(doc.connections)) {
      next.connections = doc.connections.map((c: unknown) =>
        typeof c === 'object' && c !== null ? { transfer: { kind: 'instant' }, ...c } : c,
      );
    }
    return next;
  },
  // v4 → v5: saved run settings; defaults match SE-4's session defaults.
  4: (doc) => ({
    run: { warmUp: 0, length: { unit: 'shifts', value: 1 }, seed: { mode: 'fixed', value: 1 } },
    ...doc,
    schemaVersion: 5,
  }),
};

export const loadProject: (input: unknown) => ParseResult<Project> = createUpgrader({
  currentVersion: CURRENT_SCHEMA_VERSION,
  schema: projectSchema,
  steps: upgradeSteps,
});

export function validateProject(input: unknown): ParseResult<Project> {
  return validate(projectSchema, input);
}
