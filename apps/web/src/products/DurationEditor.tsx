import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { Duration, DurationKind } from '@factory-sim/schema';
import { parseDuration } from './cycleTimes';
import { previewHistogram } from './distributions';

const INVALID = 'Enter seconds or mm:ss, greater than 0';

/**
 * One grid cell. Valid text commits on blur or Enter; invalid text stays visible with its reason
 * and never reaches the store. Empty clears the cell. A focus-to-blur session is one undo step.
 */
function TimeCell({
  label,
  value,
  commit,
  beginEdit,
  endEdit,
}: {
  label: string;
  /** Stored seconds, or null while the cell is empty. */
  value: number | null;
  commit: (seconds: number | null) => void;
  beginEdit: () => number;
  endEdit: (token: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const session = useRef(0);
  useEffect(() => () => endEdit(session.current), [endEdit]);
  const missing = value === null && draft === null;
  return (
    <>
      <input
        type="text"
        inputMode="decimal"
        aria-label={label}
        aria-invalid={error || missing ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        placeholder="sec"
        value={draft ?? (value === null ? '' : String(value))}
        onFocus={() => (session.current = beginEdit())}
        onChange={(e) => {
          const text = e.target.value;
          setDraft(text);
          setError(text.trim() === '' || parseDuration(text) !== null ? null : INVALID);
        }}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        onBlur={() => {
          // Commit only finished text: a keystroke-by-keystroke commit would leave a stale prefix
          // ("2" of "2:3x") in the store when the final text is invalid. Invalid text stays with
          // its error and the store keeps the last good value.
          if (draft !== null && !error) {
            commit(draft.trim() === '' ? null : parseDuration(draft));
            setDraft(null);
          }
          endEdit(session.current);
        }}
        style={{
          width: 72,
          padding: 4,
          textAlign: 'right',
          borderColor: error ? '#b91c1c' : missing ? '#f59e0b' : undefined,
        }}
      />
      {error && (
        <div id={errorId} role="alert" style={{ color: '#b91c1c', fontSize: 12 }}>
          {error}
        </div>
      )}
    </>
  );
}

const KINDS: { kind: DurationKind; label: string }[] = [
  { kind: 'fixed', label: 'Fixed' },
  { kind: 'normal', label: 'Normal' },
  { kind: 'triangular', label: 'Triangular' },
  { kind: 'lognormal', label: 'Lognormal' },
  { kind: 'exponential', label: 'Exponential' },
];

type Param = { key: string; label: string; zeroOk?: boolean };
const PARAMS: Record<Exclude<DurationKind, 'fixed'>, Param[]> = {
  normal: [
    { key: 'mean', label: 'Mean' },
    { key: 'stdDev', label: 'Std dev', zeroOk: true },
  ],
  triangular: [
    { key: 'min', label: 'Min', zeroOk: true },
    { key: 'mode', label: 'Most likely', zeroOk: true },
    { key: 'max', label: 'Max' },
  ],
  lognormal: [
    { key: 'mean', label: 'Mean' },
    { key: 'stdDev', label: 'Std dev', zeroOk: true },
  ],
  exponential: [{ key: 'mean', label: 'Mean' }],
};

const parseParam = (text: string, zeroOk?: boolean) =>
  parseDuration(text) ?? (zeroOk && /^0+(\.0+)?$/.test(text.trim()) ? 0 : null);

/** Bars for a seeded sample of the distribution; shows the shape, not exact values. */
function Histogram({ label, time }: { label: string; time: Duration }) {
  const key = JSON.stringify(time);
  const h = useMemo(() => previewHistogram(JSON.parse(key) as Duration), [key]);
  const peak = Math.max(...h.bins.map((b) => b.count));
  const w = 4;
  const fmt = (n: number) => String(Math.round(n * 10) / 10);
  return (
    <svg
      role="img"
      aria-label={label}
      width={h.bins.length * w}
      height={46}
      style={{ background: '#f9fafb' }}
    >
      {h.bins.map((b, i) => {
        const height = (b.count / peak) * 32;
        return (
          <rect key={i} x={i * w} y={32 - height} width={w - 1} height={height} fill="#3b82f6" />
        );
      })}
      <text x={0} y={44} fontSize={10} fill="#6b7280">
        {fmt(h.bins[0]!.from)}–{fmt(h.bins[h.bins.length - 1]!.to)} s
      </text>
    </svg>
  );
}

/**
 * One grid cell (WS-2): a kind selector, the kind's parameters, and a histogram of the stored
 * distribution. Parameters commit together once all are valid; until then the store keeps the last
 * good value. Switching kind starts with blank parameters rather than reinterpreting the old ones.
 */
export function DurationEditor({
  name,
  fixedLabel,
  time,
  setTime,
  setFixed,
  beginEdit,
  endEdit,
}: {
  /** "Product 1 at Saw", used in the accessible names of the selector, parameters and preview. */
  name: string;
  /** Accessible name of the input shown while the kind is fixed. */
  fixedLabel: string;
  time: Duration | null;
  setTime: (d: Duration) => { ok: boolean; error?: string };
  setFixed: (seconds: number | null) => void;
  beginEdit: () => number;
  endEdit: (token: number) => void;
}) {
  const [kindDraft, setKindDraft] = useState<DurationKind | null>(null);
  const [text, setText] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const session = useRef(0);
  const stored = JSON.stringify(time);
  // A store change (undo, import, commit) supersedes any half-edited state.
  useEffect(() => {
    setKindDraft(null);
    setText({});
    setError(null);
  }, [stored]);
  useEffect(() => () => endEdit(session.current), [endEdit]);

  const kind = kindDraft ?? time?.kind ?? 'fixed';
  const params = kind === 'fixed' ? [] : PARAMS[kind];
  const shown = (p: Param) => {
    const own = time?.kind === kind ? (time as Record<string, unknown>)[p.key] : undefined;
    return text[p.key] ?? (typeof own === 'number' ? String(own) : '');
  };
  const incomplete = params.some((p) => shown(p).trim() === '');

  const commitParams = (next: Record<string, string>) => {
    if (kind === 'fixed') return;
    const values: Record<string, number | null> = {};
    for (const p of PARAMS[kind]) {
      const t = next[p.key] ?? shown(p);
      if (t.trim() === '') return; // still incomplete
      values[p.key] = parseParam(t, p.zeroOk);
      if (values[p.key] === null) return setError('Enter seconds or mm:ss');
    }
    const result = setTime({ kind, ...values } as Duration);
    setError(result.ok ? null : (result.error ?? 'Invalid cycle time'));
  };

  return (
    <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
      <select
        aria-label={`Distribution, ${name}`}
        value={kind}
        onChange={(e) => {
          setKindDraft(e.target.value as DurationKind);
          setText({});
          setError(null);
        }}
        style={{ fontSize: 12 }}
      >
        {KINDS.map((k) => (
          <option key={k.kind} value={k.kind}>
            {k.kind}
          </option>
        ))}
      </select>
      {kind === 'fixed' ? (
        <TimeCell
          label={fixedLabel}
          value={time?.kind === 'fixed' ? time.value : null}
          commit={setFixed}
          beginEdit={beginEdit}
          endEdit={endEdit}
        />
      ) : (
        <div style={{ display: 'flex', gap: 4 }}>
          {params.map((p) => {
            const bad =
              text[p.key] !== undefined &&
              text[p.key]!.trim() !== '' &&
              parseParam(text[p.key]!, p.zeroOk) === null;
            return (
              <input
                key={p.key}
                type="text"
                inputMode="decimal"
                aria-label={`${p.label}, ${name}`}
                aria-invalid={bad || error || incomplete ? 'true' : undefined}
                aria-describedby={error ? errorId : undefined}
                placeholder={p.label}
                title={p.label}
                value={shown(p)}
                onFocus={() => (session.current = beginEdit())}
                onChange={(e) => setText({ ...text, [p.key]: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                onBlur={() => {
                  commitParams(text);
                  endEdit(session.current);
                }}
                style={{
                  width: 56,
                  padding: 4,
                  textAlign: 'right',
                  borderColor: bad || error ? '#b91c1c' : incomplete ? '#f59e0b' : undefined,
                }}
              />
            );
          })}
        </div>
      )}
      {params.length > 0 && (
        <span aria-hidden="true" style={{ color: '#6b7280', fontSize: 11 }}>
          {params.map((p) => p.label.toLowerCase()).join(' · ')}
        </span>
      )}
      {error && (
        <div id={errorId} role="alert" style={{ color: '#b91c1c', fontSize: 12 }}>
          {error}
        </div>
      )}
      {time && time.kind !== 'fixed' && (
        <Histogram label={`Distribution preview, ${name}`} time={time} />
      )}
    </div>
  );
}
