import { useEffect, useRef, useState } from 'react';
import type { Demand, Product } from '@factory-sim/schema';
import { useEditorStore as defaultStore, type ReleaseMode } from '../layout/editorStore';
import { Field, Section } from '../ui';
import { tokens } from '../ui/tokens';
import styles from './products.module.css';

type Store = typeof defaultStore;

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
    <Field
      label={text}
      inputMode="decimal"
      disabled={disabled}
      value={draft ?? String(value)}
      error={message}
      onFocus={() => (session.current = beginEdit())}
      onChange={(t) => {
        setDraft(t);
        const n = t.trim() === '' ? NaN : Number(t);
        setMessage(commit(n));
      }}
      onBlur={() => {
        endEdit(session.current);
        setDraft(null);
        setMessage(null);
      }}
    />
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
      <Field
        label="Sequence"
        value={draft ?? text}
        error={message}
        onFocus={() => (session.current = beginEdit())}
        onChange={(t) => {
          setDraft(t);
          const parsed = parsePattern(t, products);
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
      <div className={styles.chips}>
        {pattern.map((id, i) => {
          const p = products.find((q) => q.id === id);
          return (
            <span
              key={i}
              data-testid="sequence-chip"
              title={p?.name}
              className={styles.chip}
              // eslint-disable-next-line no-restricted-syntax -- the chip takes the product's user-chosen colour, data not styling
              style={{ background: p?.color ?? tokens.color.muted }}
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
    <Section
      className={styles.demandSection}
      heading="Demand & release"
      description="How work enters the line"
    >
      <label className={styles.selectField}>
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
        <p role="status" className={styles.hint}>
          Other products were rescaled to fit 100%
        </p>
      )}
      <label className={styles.selectField}>
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
        <p className={styles.muted}>Release interval is a distribution.</p>
      )}
      {perShift && <p className={styles.muted}>Interval follows from units per shift.</p>}
      {mode === 'sequence' && <SequenceField useStore={useStore} />}
    </Section>
  );
}
