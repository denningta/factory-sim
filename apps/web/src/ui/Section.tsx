import { useId, useState, type ReactNode } from 'react';
import styles from './Section.module.css';

/** A headed block of a panel. Collapsible sections put the heading in a button that toggles the body. */
export function Section({
  heading,
  description,
  collapsible = false,
  defaultOpen = true,
  children,
  className,
}: {
  heading: string;
  description?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();
  const shown = !collapsible || open;
  return (
    <section className={[styles.section, className].filter(Boolean).join(' ')}>
      <h2 className={styles.heading}>
        {collapsible ? (
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => setOpen(!open)}
          >
            <span aria-hidden="true">{open ? '▾' : '▸'}</span> {heading}
          </button>
        ) : (
          heading
        )}
      </h2>
      {description && <p className={styles.description}>{description}</p>}
      {/* hidden, not unmounted: a closed section keeps its children's state and aria-controls target */}
      <div id={bodyId} className={styles.body} hidden={!shown}>
        {children}
      </div>
    </section>
  );
}

/** Forgets which collapsible sections the user opened or closed (tests, and a new session). */
export function resetSectionMemory(): void {
  throw new Error('not implemented');
}
