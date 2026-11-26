import type { ModelIssue } from '@factory-sim/sim-engine';
import styles from './ModelCheckBanner.module.css';

/** SE-5 as a banner: success tone when the model can run, danger tone listing what blocks it. */
export function ModelCheckBanner({
  issues,
  onSelect,
}: {
  issues: readonly ModelIssue[];
  onSelect: (issue: ModelIssue) => void;
}) {
  if (issues.length === 0)
    return (
      <div role="status" aria-label="Model check" className={`${styles.banner} ${styles.ok}`}>
        Model check passed · 0 errors
      </div>
    );
  return (
    <div role="alert" aria-label="Model check" className={`${styles.banner} ${styles.bad}`}>
      <p className={styles.title}>
        Model check failed · {issues.length} {issues.length === 1 ? 'error' : 'errors'}. The line
        can't run yet:
      </p>
      <ul className={styles.list}>
        {issues.map((i, k) => (
          <li key={k}>
            {i.objectId ? (
              <button type="button" className={styles.issue} onClick={() => onSelect(i)}>
                {i.message}
              </button>
            ) : (
              i.message
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
