import type { CycleTime, Project } from '@factory-sim/schema';

export interface CycleTimeEntry {
  productId: string;
  stationId: string;
  seconds: number;
}

export interface MissingCycleTime {
  productId: string;
  stationId: string;
}

export interface ImportResult {
  entries: CycleTimeEntry[];
  /** One human-readable line per cell or row that was skipped. */
  errors: string[];
}

/** Seconds from "45", "1.5", "m:ss" or "h:mm:ss"; null if it isn't a positive duration. */
export function parseDuration(_text: string): number | null {
  throw new Error('not implemented');
}

/** (product, station) pairs a routing uses that have no cycle time yet. */
export function missingCycleTimes(
  _project: Pick<Project, 'products'> & { cycleTimes: CycleTime[] },
): MissingCycleTime[] {
  throw new Error('not implemented');
}

/** Parses pasted/CSV text: a header of station names, then one row per part number. */
export function parseCycleTimeTable(
  _text: string,
  _project: Pick<Project, 'products' | 'equipment'>,
): ImportResult {
  throw new Error('not implemented');
}
