import type { Equipment } from '@factory-sim/schema';

export interface LayoutIssues {
  /** Pairs whose footprints overlap. */
  overlaps: [string, string][];
  /** Pairs that don't overlap but sit closer than the clearance. */
  tooClose: [string, string][];
  /** Every equipment id involved in an overlap. */
  overlappingIds: Set<string>;
  /** Every equipment id involved in a clearance violation. */
  tooCloseIds: Set<string>;
  count: number;
}

export function findIssues(
  _equipment: readonly Equipment[],
  _clearance: number | null,
): LayoutIssues {
  throw new Error('not implemented');
}
