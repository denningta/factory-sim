import type { RunStats } from '@factory-sim/sim-engine';

type Named = { id: string; name: string };

/** Station and technician utilization as stacked bars with legends, highest working % first. */
export function UtilizationBars(_props: {
  stats: RunStats;
  stations: Named[];
  techs: Named[];
  bottleneckId?: string | null;
}) {
  return null;
}
