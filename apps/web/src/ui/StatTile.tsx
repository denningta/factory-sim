import type { ReactNode } from 'react';
import styles from './StatTile.module.css';

/** A KPI: label, a big value with an optional unit, and a small sub-line. */
export function StatTile({
  label,
  value,
  unit,
  sub,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  sub?: ReactNode;
}) {
  return (
    <div role="group" aria-label={label} className={styles.tile}>
      <div className={styles.label}>{label}</div>
      <div className={styles.value}>
        {value}
        {unit && <small className={styles.unit}> {unit}</small>}
      </div>
      {sub && <div className={styles.sub}>{sub}</div>}
    </div>
  );
}
