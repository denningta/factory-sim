import styles from './Legend.module.css';

/** Colour key. `color` comes from the tokens; the swatch is decorative, the label carries the meaning. */
export function Legend({
  label,
  items,
}: {
  label: string;
  items: readonly { key: string; label: string; color: string }[];
}) {
  return (
    <ul aria-label={label} className={styles.legend}>
      {items.map((i) => (
        <li key={i.key} className={styles.item}>
          {/* eslint-disable-next-line no-restricted-syntax -- the swatch colour is data (a token passed in), not a hand-written style */}
          <span className={styles.swatch} style={{ background: i.color }} aria-hidden="true" />
          {i.label}
        </li>
      ))}
    </ul>
  );
}
