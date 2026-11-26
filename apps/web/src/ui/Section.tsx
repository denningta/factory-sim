import { useId, useState, type ReactNode } from 'react';
import styles from './Section.module.css';

/** Open/closed state of sections that opted in with `memoryKey`; lives as long as the page. */
const remembered = new Map<string, boolean>();

/** Forgets which collapsible sections the user opened or closed (tests, and a new session). */
export function resetSectionMemory(): void {
  remembered.clear();
}

/** A headed block of a panel. Collapsible sections put the heading in a button that toggles the body. */
export function Section({
  heading,
  description,
  collapsible = false,
  defaultOpen = true,
  memoryKey,
  children,
  className,
}: {
  heading: string;
  description?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Remember open/closed across remounts for the session, e.g. when the selection changes. */
  memoryKey?: string;
  children?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(
    () => (memoryKey ? remembered.get(memoryKey) : undefined) ?? defaultOpen,
  );
  const bodyId = useId();
  const headingId = useId();
  const shown = !collapsible || open;
  return (
    <section
      aria-labelledby={headingId}
      className={[styles.section, className].filter(Boolean).join(' ')}
    >
      <h2 id={headingId} className={styles.heading}>
        {collapsible ? (
          <button
            type="button"
            className={styles.toggle}
            aria-expanded={open}
            aria-controls={bodyId}
            onClick={() => {
              setOpen(!open);
              if (memoryKey) remembered.set(memoryKey, !open);
            }}
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
