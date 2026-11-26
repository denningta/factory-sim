import { useEffect, useRef, useState } from 'react';
import { Field as UiField } from '../ui';
import styles from './panels.module.css';

/**
 * A text field that commits each keystroke through `commit`, which returns an error reason or
 * null. Invalid text stays visible with its reason; the store never receives it. On blur the
 * field reverts to the stored value.
 */
export function Field({
  label,
  value,
  commit,
  extraError,
  onBlur,
  placeholder,
  describedBy,
  beginEdit,
  endEdit,
}: {
  label: string;
  value: string;
  commit: (text: string) => string | null;
  /** A reason set from outside, e.g. the other field of a rule that spans two fields. */
  extraError?: string | null;
  onBlur?: () => void;
  placeholder?: string;
  /** Id of a hint element elsewhere that describes this field. */
  describedBy?: string;
  /** One focus-to-blur (or Enter) session is one undo step, however many keystrokes. */
  beginEdit: () => number;
  endEdit: (token: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The field can unmount while focused (selection changes); close its session then.
  const session = useRef(0);
  const begin = () => {
    session.current = beginEdit();
  };
  const end = () => endEdit(session.current);
  useEffect(() => () => endEdit(session.current), [endEdit]);
  return (
    <UiField
      className={styles.fieldRow}
      label={label}
      inputMode="decimal"
      value={draft ?? value}
      placeholder={placeholder}
      error={error ?? extraError ?? null}
      aria-describedby={describedBy}
      onFocus={begin}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return;
        end();
        begin();
      }}
      onChange={(text) => {
        setDraft(text);
        setError(commit(text));
      }}
      onBlur={() => {
        end();
        setDraft(null);
        setError(null);
        onBlur?.();
      }}
    />
  );
}

/** Parses typed text as a finite number, or returns the reason it can't be. */
export function parseNumber(text: string): number | string {
  const n = Number(text);
  return text.trim() === '' || !Number.isFinite(n) ? 'Enter a number' : n;
}
