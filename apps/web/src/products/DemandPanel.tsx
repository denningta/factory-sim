import { useEffect, useRef, useState } from 'react';
import type { Demand, Product } from '@factory-sim/schema';
import { useEditorStore as defaultStore, type ReleaseMode } from '../layout/editorStore';

type Store = typeof defaultStore;

const label = { display: 'flex', flexDirection: 'column', gap: 4 } as const;
const error = { color: '#b91c1c', fontSize: 12 } as const;

/** A number field that commits each valid keystroke; invalid text stays visible with its reason. */
function NumberField({
  label: text,
  value,
  commit,
  disabled,
  beginEdit,
  endEdit,
}: {
  label: string;
  value: number;
  commit: (n: number) => string | null;
  disabled?: boolean;
  beginEdit: () => number;
  endEdit: (token: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const session = useRef(0);
  useEffect(() => () => endEdit(session.current), [endEdit]);
  return (
    <label style={label}>
      {text}
      <input
        type="text"
        inputMode="decimal"
        disabled={disabled}
        value={draft ?? String(value)}
        aria-invalid={message ? 'true' : undefined}
        onFocus={() => (session.current = beginEdit())}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = e.target.value.trim() === '' ? NaN : Number(e.target.value);
          setMessage(commit(n));
        }}
        onBlur={() => {
          endEdit(session.current);
          setDraft(null);
          setMessage(null);
        }}
      />
      {message && (
        <span role="alert" style={error}>
          {message}
        </span>
      )}
    </label>
  );
}

/** Product ids for text like "A A B": each token is a part number or a name. */
function parsePattern(text: string, products: Product[]): { ids: string[] } | { error: string } {
  const ids: string[] = [];
  for (const token of text.split(/[\s,]+/).filter(Boolean)) {
    const t = token.toLowerCase();
    const match = products.find(
      (p) => p.partNumber.toLowerCase() === t || p.name.toLowerCase() === t,
    );
    if (!match) return { error: `"${token}" isn't a product part number or name` };
    ids.push(match.id);
  }
  return ids.length > 0 ? { ids } : { error: 'Add at least one product' };
}

function SequenceField({ useStore }: { useStore: Store }) {
  const { products, release, setReleasePattern, beginEdit, endEdit } = useStore();
  const pattern = release.product.kind === 'sequence' ? release.product.pattern : [];
  const text = pattern.map((id) => products.find((p) => p.id === id)?.partNumber ?? id).join(' ');
  const [draft, setDraft] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const session = useRef(0);
  useEffect(() => () => endEdit(session.current), [endEdit]);
  return (
    <>
      <label style={label}>
        Sequence
        <input
          type="text"
          value={draft ?? text}
          aria-invalid={message ? 'true' : undefined}
          onFocus={() => (session.current = beginEdit())}
          onChange={(e) => {
            setDraft(e.target.value);
            const parsed = parsePattern(e.target.value, products);
            if ('error' in parsed) return setMessage(parsed.error);
            const r = setReleasePattern(parsed.ids);
            setMessage(r.ok ? null : r.error);
          }}
          onBlur={() => {
            endEdit(session.current);
            setDraft(null);
            setMessage(null);
          }}
        />
        {message && (
          <span role="alert" style={error}>
            {message}
          </span>
        )}
      </label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {pattern.map((id, i) => {
          const p = products.find((q) => q.id === id);
          return (
            <span
              key={i}
              data-testid="sequence-chip"
              title={p?.name}
              style={{
                background: p?.color ?? '#6b7280',
                color: 'white',
                borderRadius: 4,
                padding: '4px 8px',
                fontWeight: 600,
              }}
            >
              {p?.partNumber ?? '?'}
            </span>
          );
        })}
      </div>
    </>
  );
}

const MODES: { value: ReleaseMode; text: string }[] = [
  { value: 'fixed', text: 'Fixed interval' },
  { value: 'random', text: 'Random by mix' },
  { value: 'sequence', text: 'Repeating sequence (heijunka)' },
];

/** Wireframe 2, right panel: demand mix and release rule (PR-4). */
export function DemandPanel({ useStore = defaultStore }: { useStore?: Store }) {
  const {
    products,
    demand,
    demandRescaled,
    release,
    setDemandBasis,
    setDemandValue,
    setReleaseMode,
    setReleaseInterval,
    beginEdit,
    endEdit,
  } = useStore();
  const perShift = demand.basis === 'perShift';
  const mode: ReleaseMode = release.product.kind === 'smooth' ? 'fixed' : release.product.kind;
  const interval = release.interval.kind === 'fixed' ? release.interval.value : null;
  return (
    <section style={{ padding: 16, display: 'grid', gap: 8, alignContent: 'start' }}>
      <h2 style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', margin: 0 }}>
        Demand &amp; release
      </h2>
      <p style={{ color: '#6b7280', margin: 0 }}>How work enters the line</p>
      <label style={label}>
        Demand as
        <select
          value={demand.basis}
          onChange={(e) => setDemandBasis(e.target.value as Demand['basis'])}
        >
          <option value="mix">% of mix</option>
          <option value="perShift">Units per shift</option>
        </select>
      </label>
      {products.map((p) => (
        <NumberField
          key={p.id}
          label={`${p.name} (${perShift ? 'units / shift' : '% of mix'})`}
          value={demand.items.find((i) => i.productId === p.id)?.value ?? 0}
          commit={(n) => {
            const r = setDemandValue(p.id, n);
            return r.ok ? null : r.error;
          }}
          beginEdit={beginEdit}
          endEdit={endEdit}
        />
      ))}
      {!perShift && demandRescaled && (
        <p role="status" style={{ color: '#6b7280', fontSize: 12, margin: 0 }}>
          Every other product was already set, so they were rescaled to fit.
        </p>
      )}
      <label style={label}>
        Release rule
        <select value={mode} onChange={(e) => setReleaseMode(e.target.value as ReleaseMode)}>
          {MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {m.text}
            </option>
          ))}
        </select>
      </label>
      {interval !== null ? (
        <NumberField
          label="Release interval (s)"
          value={interval}
          disabled={perShift}
          commit={(n) => {
            const r = setReleaseInterval(n);
            return r.ok ? null : r.error;
          }}
          beginEdit={beginEdit}
          endEdit={endEdit}
        />
      ) : (
        <p style={{ color: '#6b7280', margin: 0 }}>Release interval is a distribution.</p>
      )}
      {perShift && (
        <p style={{ color: '#6b7280', margin: 0 }}>Interval follows from units per shift.</p>
      )}
      {mode === 'sequence' && <SequenceField useStore={useStore} />}
    </section>
  );
}
