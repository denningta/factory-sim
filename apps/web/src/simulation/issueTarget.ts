import type { Project } from '@factory-sim/schema';
import type { ModelIssue } from '@factory-sim/sim-engine';

export type IssueTarget =
  { screen: 'layout'; equipmentId: string } | { screen: 'products'; productId: string };

/**
 * Where a clicked issue points: its objectId is equipment, a routing step (→ its station)
 * or a product (→ the products screen).
 */
export function issueTarget(
  project: Pick<Project, 'equipment' | 'products'>,
  issue: ModelIssue,
): IssueTarget | undefined {
  const id = issue.objectId;
  if (id === undefined) return undefined;
  if (project.equipment.some((e) => e.id === id)) return { screen: 'layout', equipmentId: id };
  if (project.products.some((p) => p.id === id)) return { screen: 'products', productId: id };
  for (const p of project.products) {
    const step = p.routing.find((s) => s.id === id);
    if (!step) continue;
    // A missing cycle time is fixed in the product's grid; other step issues are about the station.
    return issue.code === 'missing_cycle_time'
      ? { screen: 'products', productId: p.id }
      : { screen: 'layout', equipmentId: step.stationId };
  }
  return undefined;
}
