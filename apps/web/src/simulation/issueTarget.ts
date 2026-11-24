import type { Project } from '@factory-sim/schema';
import type { ModelIssue } from '@factory-sim/sim-engine';

export type IssueTarget =
  { screen: 'layout'; equipmentId: string } | { screen: 'products'; productId: string };

/**
 * Where a clicked issue points: its objectId is equipment, a routing step (→ its station)
 * or a product (→ the products screen).
 */
export function issueTarget(
  _project: Pick<Project, 'equipment' | 'products'>,
  _issue: ModelIssue,
): IssueTarget | undefined {
  throw new Error('not implemented');
}
