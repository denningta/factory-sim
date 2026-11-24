import type { RunStats } from '@factory-sim/sim-engine';

export interface KpiRow {
  id: string;
  name: string;
  throughputPerHour: number;
  throughputPerShift: number;
  averageWip: number;
  /** Seconds; null when no part has exited in the window. */
  leadTime: number | null;
}

export interface Kpis {
  products: KpiRow[];
  total: KpiRow;
}

/** Turns engine stats into the figures the KPI panel shows (AN-1). */
export function computeKpis(
  _stats: RunStats,
  _products: { id: string; name: string }[],
  _shiftLength: number,
): Kpis {
  throw new Error('not implemented');
}
