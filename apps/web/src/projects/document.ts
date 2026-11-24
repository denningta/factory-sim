import type { Project } from '@factory-sim/schema';

/** The editor store's slices that autosave writes back. */
export type EditedParts = Pick<
  Project,
  | 'floor'
  | 'equipment'
  | 'products'
  | 'connections'
  | 'cycleTimes'
  | 'technicians'
  | 'demand'
  | 'release'
>;

/**
 * The document to save: the loaded document with the editor's slices on top. Spreading
 * `base` keeps every section the editor doesn't manage yet (calendar, …) instead of dropping it.
 */
export function documentForSave(
  base: Project,
  {
    shiftLength,
    run,
    minClearance,
    ...parts
  }: EditedParts & { shiftLength?: number; run?: Project['run']; minClearance?: number | null },
): Project {
  const calendar = shiftLength === undefined ? base.calendar : { ...base.calendar, shiftLength };
  void minClearance; // stub
  return { ...base, ...parts, calendar, run: run ?? base.run };
}
