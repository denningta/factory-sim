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
      {shown && (
        <div id={bodyId} className={styles.body}>
          {children}
        </div>
      )}
    </section>
  );
}
