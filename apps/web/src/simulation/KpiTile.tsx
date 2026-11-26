import type { ReactNode } from 'react';
import styles from './KpiTile.module.css';

/** One live figure: icon, label, big value with unit, a per-product sub-line and the warm-up note. */
export function KpiTile({
  label,
  icon,
  value,
  unit,
  sub,
}: {
  label: string;
  icon: ReactNode;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
}) {
  return (
    <div role="group" aria-label={label} className={styles.tile}>
      <span className={styles.icon} aria-hidden="true">
        {icon}
      </span>
      <div className={styles.body}>
        <div className={styles.label}>{label}</div>
        <div className={styles.value}>
          {value}
          {unit && <small className={styles.unit}> {unit}</small>}
        </div>
        <div className={styles.sub}>{sub ?? ' '}</div>
        <div className={styles.note}>Warm-up excluded</div>
      </div>
    </div>
  );
}

const svg = (d: ReactNode) => (
  <svg
    viewBox="0 0 24 24"
    width="20"
    height="20"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {d}
  </svg>
);
export const ThroughputIcon = () => svg(<path d="M3 17l5-5 4 4 8-9M15 7h5v5" />);
export const WipIcon = () =>
  svg(<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM4 7.5l8 4.5 8-4.5M12 12v9" />);
export const LeadTimeIcon = () => svg(<path d="M12 7v5l3 2M12 3a9 9 0 100 18 9 9 0 000-18z" />);
export const BottleneckIcon = () => svg(<path d="M4 4h16l-6 8v6l-4 2v-8L4 4z" />);
