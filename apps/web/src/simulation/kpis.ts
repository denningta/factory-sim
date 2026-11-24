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

const row = (id: string, name: string, f: RunStats['total'], shiftLength: number): KpiRow => ({
  id,
  name,
  throughputPerHour: f.throughputPerHour,
  throughputPerShift: (f.throughputPerHour * shiftLength) / 3600,
  averageWip: f.averageWip,
  // The engine reports NaN when nothing has exited.
  leadTime: Number.isNaN(f.averageLeadTime) ? null : f.averageLeadTime,
});

const NONE: RunStats['total'] = {
  released: 0,
  completed: 0,
  throughputPerHour: 0,
  averageWip: 0,
  averageLeadTime: NaN,
};

/** Turns engine stats (already warm-up-free) into the figures the KPI panel shows (AN-1). */
export function computeKpis(
  stats: RunStats,
  products: { id: string; name: string }[],
  shiftLength: number,
): Kpis {
  return {
    products: products.map((p) => row(p.id, p.name, stats.byProduct[p.id] ?? NONE, shiftLength)),
    total: row('total', 'Total', stats.total, shiftLength),
  };
}
