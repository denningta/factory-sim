import { Badge } from './Badge';
import styles from './Tabs.module.css';

/** A row of tabs; the caller renders the panel for `value`. */
export function Tabs<Id extends string>({
  label,
  items,
  value,
  onChange,
  className,
}: {
  label: string;
  /** `badge` is a count of open problems on that screen; 0 or missing shows nothing. */
  items: readonly { id: Id; label: string; badge?: number }[];
  value: Id;
  onChange: (id: Id) => void;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={[styles.tabs, className].filter(Boolean).join(' ')}
    >
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={t.id === value}
          className={styles.tab}
          onClick={() => onChange(t.id)}
        >
          {t.label}
          {t.badge ? (
            <>
              {' '}
              <Badge tone="warning" aria-hidden>
                {t.badge}
              </Badge>
              <span className={styles.sr}>
                {t.badge} open problem{t.badge === 1 ? '' : 's'}
              </span>
            </>
          ) : null}
        </button>
      ))}
    </div>
  );
}
