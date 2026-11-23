import type { Project } from '@factory-sim/schema';

export interface PreRunIssue {
  code: 'no_products' | 'missing_cycle_times';
  message: string;
}

/** Reasons a run can't start yet. The run button (SIM) disables itself while this is non-empty. */
export function preRunIssues(
  project: Pick<Project, 'products' | 'cycleTimes' | 'equipment'>,
): PreRunIssue[] {
  return project.products.length === 0
    ? [{ code: 'no_products', message: 'A run needs at least one product. Add one first.' }]
    : [];
}
