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
};

export const loadProject: (input: unknown) => ParseResult<Project> = createUpgrader({
  currentVersion: CURRENT_SCHEMA_VERSION,
  schema: projectSchema,
  steps: upgradeSteps,
});

export function validateProject(input: unknown): ParseResult<Project> {
  return validate(projectSchema, input);
}
