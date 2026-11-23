import type { Project } from '@factory-sim/schema';
import { missingCycleTimes } from './cycleTimes';

export interface PreRunIssue {
  code: 'no_products' | 'missing_cycle_times' | 'manual_station_without_tech';
  message: string;
}

const SHOWN = 3;

/** Reasons a run can't start yet. The run button (SIM) disables itself while this is non-empty. */
export function preRunIssues(
  project: Pick<Project, 'products' | 'cycleTimes' | 'equipment' | 'technicians'>,
): PreRunIssue[] {
  if (project.products.length === 0)
    return [{ code: 'no_products', message: 'A run needs at least one product. Add one first.' }];
  const missing = missingCycleTimes(project);
  if (missing.length === 0) return [];
  const label = ({ productId, stationId }: (typeof missing)[number]) =>
    `${project.products.find((p) => p.id === productId)?.name} at ${project.equipment.find((e) => e.id === stationId)?.name}`;
  const rest = missing.length - SHOWN;
  return [
    {
      code: 'missing_cycle_times',
      message:
        `${missing.length} cycle time${missing.length === 1 ? '' : 's'} missing: ` +
        missing.slice(0, SHOWN).map(label).join(', ') +
        (rest > 0 ? `, and ${rest} more` : ''),
    },
  ];
}
