import type { Project } from '@factory-sim/schema';

/** The editor store's slices that autosave writes back. */
export type EditedParts = Pick<
  Project,
  'floor' | 'equipment' | 'products' | 'connections' | 'cycleTimes'
>;

/**
 * The document to save: the loaded document with the editor's slices on top. Spreading
 * `base` keeps every section the editor doesn't manage yet (calendar, demand, release,
 * technicians, …) instead of dropping it.
 */
export function documentForSave(base: Project, parts: EditedParts): Project {
  return { ...base, ...parts };
}
