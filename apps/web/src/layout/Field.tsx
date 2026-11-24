import { useEffect, useId, useRef, useState } from 'react';

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
  const errorId = useId();
  const shown = error ?? extraError ?? null;
  // The field can unmount while focused (selection changes); close its session then.
  const session = useRef(0);
  const begin = () => {
    session.current = beginEdit();
  };
  const end = () => endEdit(session.current);
  useEffect(() => () => endEdit(session.current), [endEdit]);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
      {label}
      <input
        type="text"
        inputMode="decimal"
        value={draft ?? value}
        placeholder={placeholder}
        aria-invalid={shown ? 'true' : undefined}
        aria-describedby={
          [shown ? errorId : null, describedBy].filter(Boolean).join(' ') || undefined
        }
        onFocus={begin}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          end();
          begin();
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          setError(commit(e.target.value));
        }}
        onBlur={() => {
          end();
          setDraft(null);
          setError(null);
          onBlur?.();
        }}
      />
      {shown && (
        <span id={errorId} role="alert" style={{ color: '#b91c1c', fontSize: 12 }}>
          {shown}
        </span>
      )}
    </label>
  );
}

/** Parses typed text as a finite number, or returns the reason it can't be. */
export function parseNumber(text: string): number | string {
  const n = Number(text);
  return text.trim() === '' || !Number.isFinite(n) ? 'Enter a number' : n;
}
