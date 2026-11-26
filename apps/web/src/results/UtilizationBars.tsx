import type { RunStats } from '@factory-sim/sim-engine';
import { stateLabel } from '../simulation/stationStatus';
import { Legend } from '../ui/Legend';
import {
  stationUtilization,
  techUtilization,
  type StationKey,
  type TechKey,
  type UtilRow,
} from '../simulation/utilization';
import styles from './UtilizationBars.module.css';

type Named = { id: string; name: string };
type Segment<K extends string> = { key: K; label: string; color: string; className: string };

// Station "idle" is a station waiting for its technician; technicians really are idle.
const STATION_SEGMENTS: Segment<StationKey>[] = [
  { key: 'working', label: 'Working', color: 'var(--state-working-tint)', className: 'working' },
  { key: 'starved', label: 'Starved', color: 'var(--state-starved-tint)', className: 'starved' },
  { key: 'blocked', label: 'Blocked', color: 'var(--state-blocked-tint)', className: 'blocked' },
  {
    key: 'idle',
    label: stateLabel('idle'),
    color: 'var(--state-waiting-tint)',
    className: 'waiting',
  },
];
const TECH_SEGMENTS: Segment<TechKey>[] = [
  { key: 'working', label: 'Working', color: 'var(--state-working-tint)', className: 'working' },
  { key: 'walking', label: 'Walking', color: 'var(--state-walking-tint)', className: 'walking' },
  { key: 'idle', label: 'Idle', color: 'var(--state-waiting-tint)', className: 'waiting' },
];

const pct = (v: number) => `${v.toFixed(1)}%`;

function Group<K extends string>({
  label,
  rows,
  segments,
  bottleneckId,
}: {
  label: string;
  rows: (UtilRow<K> & { working: number })[];
  segments: Segment<K>[];
  bottleneckId?: string | null;
}) {
  // Stable sort: ties keep placement order.
  const sorted = [...rows].sort((a, b) => b.working - a.working);
  return (
    <div className={styles.group}>
      <h3 className={styles.title}>{label}</h3>
      <Legend
        label={`${label} legend`}
        items={segments.map((s) => ({ key: s.key, label: s.label, color: s.color }))}
      />
      <ul aria-label={label} className={styles.list}>
        {sorted.map((r) => (
          <li key={r.id} className={styles.row}>
            <span className={styles.name}>
              {r.name}
              {r.id === bottleneckId && <span className={styles.flag}> ▲ Bottleneck</span>}
            </span>
            <span className={styles.share}>{pct(r.working)}</span>
            <div
              role="img"
              aria-label={`${r.name}: ${segments.map((s) => `${s.label.toLowerCase()} ${pct(r[s.key])}`).join(', ')}`}
              className={styles.bar}
            >
              {segments
                // Zero-width segments would still add a gap and stop a full bar short of the track.
                .filter((s) => r[s.key] > 0)
                .map((s) => (
                  <span
                    key={s.key}
                    title={`${s.label} ${pct(r[s.key])}`}
                    className={styles[s.className]}
                    // eslint-disable-next-line no-restricted-syntax -- the width is the measured share
                    style={{ width: `${r[s.key]}%` }}
                  />
                ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Station and technician utilization as stacked bars with legends, highest working % first. */
export function UtilizationBars({
  stats,
  stations,
  techs,
  bottleneckId,
}: {
  stats: RunStats;
  stations: Named[];
  techs: Named[];
  bottleneckId?: string | null;
}) {
  return (
    <div className={styles.root}>
      <Group
        label="Station utilization"
        rows={stationUtilization(stats, stations)}
        segments={STATION_SEGMENTS}
        bottleneckId={bottleneckId}
      />
      <Group
        label="Technician utilization"
        rows={techUtilization(stats, techs)}
        segments={TECH_SEGMENTS}
      />
    </div>
  );
}
