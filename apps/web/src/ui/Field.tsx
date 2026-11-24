import { useId, type InputHTMLAttributes } from 'react';
import styles from './Field.module.css';

/**
 * A labelled input. The label names it (`htmlFor`), and the hint and error text are tied to it
 * with `aria-describedby`; an error also sets `aria-invalid`.
 */
export function Field({
  label,
  unit,
  hint,
  error,
  onChange,
  className,
  'aria-describedby': describedBy,
  ...input
}: Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  label: string;
  /** Suffix shown inside the field, e.g. "m". */
  unit?: string;
  hint?: string;
  error?: string | null;
  onChange?: (value: string) => void;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const described =
    [error ? errorId : null, hint ? hintId : null, describedBy].filter(Boolean).join(' ') ||
    undefined;
  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={id} className={styles.label}>
        {label}
      </label>
      <span className={styles.control}>
        <input
          id={id}
          type="text"
          className={styles.input}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={described}
          onChange={(e) => onChange?.(e.target.value)}
          {...input}
        />
        {unit && <span className={styles.unit}>{unit}</span>}
      </span>
      {hint && (
        <small id={hintId} className={styles.hint}>
          {hint}
        </small>
      )}
      {error && (
        <span id={errorId} role="alert" className={styles.error}>
          {error}
        </span>
      )}
    </div>
  );
}
