import type { Project } from '@factory-sim/schema';
import { missingCycleTimes } from './cycleTimes';

export interface PreRunIssue {
  code: 'no_products' | 'missing_cycle_times' | 'manual_station_without_tech';
  message: string;
}

const SHOWN = 3;

/** "a, b, and 2 more": at most SHOWN names so a big line doesn't flood the panel. */
function listed(names: string[]): string {
  const rest = names.length - SHOWN;
  return names.slice(0, SHOWN).join(', ') + (rest > 0 ? `, and ${rest} more` : '');
}

/** Reasons a run can't start yet. The run button (SIM) disables itself while this is non-empty. */
export function preRunIssues(
  project: Pick<Project, 'products' | 'cycleTimes' | 'equipment' | 'technicians'>,
): PreRunIssue[] {
  if (project.products.length === 0)
    return [{ code: 'no_products', message: 'A run needs at least one product. Add one first.' }];
  const issues: PreRunIssue[] = [];
  const missing = missingCycleTimes(project);
  if (missing.length > 0) {
    const label = ({ productId, stationId }: (typeof missing)[number]) =>
      `${project.products.find((p) => p.id === productId)?.name} at ${project.equipment.find((e) => e.id === stationId)?.name}`;
    issues.push({
      code: 'missing_cycle_times',
      message: `${missing.length} cycle time${missing.length === 1 ? '' : 's'} missing: ${listed(missing.map(label))}`,
    });
  }
  // A manual station needs a tech present for the whole cycle; an automatic one runs alone.
  const unstaffed = project.equipment.filter(
    (e) =>
      e.behavior === 'workstation' &&
      e.params.labor.mode === 'manual' &&
      !project.technicians.some((t) => t.stationIds.includes(e.id)),
  );
  if (unstaffed.length > 0)
    issues.push({
      code: 'manual_station_without_tech',
      message: `${unstaffed.length} manual station${unstaffed.length === 1 ? ' has' : 's have'} no technician: ${listed(unstaffed.map((e) => e.name))}`,
    });
  return issues;
}
