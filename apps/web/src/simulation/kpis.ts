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
  products: readonly { id: string; name: string }[],
  shiftLength: number,
): Kpis {
  return {
    products: products.map((p) => row(p.id, p.name, stats.byProduct[p.id] ?? NONE, shiftLength)),
    total: row('total', 'Total', stats.total, shiftLength),
  };
}

/** Display only: seconds below a minute, minutes above; the engine keeps seconds. */
export function formatLeadTime(seconds: number | null): string {
  if (seconds === null) return '–';
  return seconds < 60 ? `${seconds.toFixed(1)} s` : `${(seconds / 60).toFixed(1)} min`;
}

export interface LittlesLaw {
  /** null while there is nothing to check (no part has exited). */
  ok: boolean | null;
  /** Throughput × lead time, in units. */
  expectedWip: number;
  /** |WIP − X·W| / WIP. */
  deviation: number;
}

/** Same tolerance as AN-1 / the reference model. */
export const LITTLES_LAW_TOLERANCE = 0.05;

export function littlesLaw(total: KpiRow): LittlesLaw {
  if (total.leadTime === null || total.averageWip <= 0)
    return { ok: null, expectedWip: 0, deviation: 0 };
  const expectedWip = (total.throughputPerHour / 3600) * total.leadTime;
  const deviation = Math.abs(total.averageWip - expectedWip) / total.averageWip;
  return { ok: deviation <= LITTLES_LAW_TOLERANCE, expectedWip, deviation };
}
