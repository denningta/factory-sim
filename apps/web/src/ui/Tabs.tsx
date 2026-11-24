import styles from './Tabs.module.css';

/** A row of tabs; the caller renders the panel for `value`. */
export function Tabs<Id extends string>({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: readonly { id: Id; label: string }[];
  value: Id;
  onChange: (id: Id) => void;
}) {
  return (
    <div role="tablist" aria-label={label} className={styles.tabs}>
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
        </button>
      ))}
    </div>
  );
}
