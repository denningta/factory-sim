/**
 * Versioned project document schema (ADR-0006). One schema for web and API.
 *
 * - `validateProject` on save: the document must already be the current version.
 * - `loadProject` on open: upgrades older documents, then validates.
 *
 * To make a breaking change: bump CURRENT_SCHEMA_VERSION, change the schema, add
 * `upgradeSteps[previousVersion]` and a test that upgrades a sample of the old version.
 * Adding an optional field or a new union member needs no bump.
 */
import { CURRENT_SCHEMA_VERSION, projectSchema, type Project } from './project';
import { createUpgrader, validate, type ParseResult, type UpgradeStep } from './upgrade';

export * from './project';
export { createUpgrader, formatIssues, type ParseResult, type UpgradeStep } from './upgrade';

/** Keyed by the version each step upgrades from. Empty while v1 is the only version. */
const upgradeSteps: Readonly<Record<number, UpgradeStep>> = {};

export const loadProject: (input: unknown) => ParseResult<Project> = createUpgrader({
  currentVersion: CURRENT_SCHEMA_VERSION,
  schema: projectSchema,
  steps: upgradeSteps,
});

export function validateProject(input: unknown): ParseResult<Project> {
  return validate(projectSchema, input);
}
