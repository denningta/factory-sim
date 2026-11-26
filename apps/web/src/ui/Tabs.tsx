import { Badge } from './Badge';
import styles from './Tabs.module.css';

/** A row of tabs; the caller renders the panel for `value`. */
export function Tabs<Id extends string>({
  label,
  items,
  value,
  onChange,
  className,
  idPrefix,
}: {
  label: string;
  /** `badge` is a count of open problems on that screen; 0 or missing shows nothing. */
  items: readonly { id: Id; label: string; badge?: number }[];
  value: Id;
  onChange: (id: Id) => void;
  className?: string;
  /**
   * With a prefix, tab ids are `<prefix>-tab-<id>` and each tab points (aria-controls) at the
   * caller's panel `<prefix>-panel`, which should carry role=tabpanel.
   */
  idPrefix?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      onKeyDown={(e) => {
        const i = items.findIndex((t) => t.id === value);
        const last = items.length - 1;
        const next =
          e.key === 'ArrowRight'
            ? (i + 1) % items.length
            : e.key === 'ArrowLeft'
              ? (i - 1 + items.length) % items.length
              : e.key === 'Home'
                ? 0
                : e.key === 'End'
                  ? last
                  : -1;
        if (next < 0) return;
        e.preventDefault();
        onChange(items[next]!.id);
        // Focus follows selection (automatic activation).
        e.currentTarget.querySelectorAll<HTMLElement>('[role="tab"]')[next]?.focus();
      }}
      className={[styles.tabs, className].filter(Boolean).join(' ')}
    >
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          id={idPrefix ? `${idPrefix}-tab-${t.id}` : undefined}
          aria-controls={idPrefix ? `${idPrefix}-panel` : undefined}
          aria-selected={t.id === value}
          tabIndex={t.id === value ? 0 : -1}
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
