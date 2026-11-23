import { useEffect, useId, useRef, useState } from 'react';
import { useEditorStore as defaultStore } from '../layout/editorStore';
import { preRunIssues } from './preRunIssues';
import { CycleTimeGrid } from './CycleTimeGrid';
import { DemandPanel } from './DemandPanel';
import { RoutingEditor } from './RoutingEditor';

type Store = typeof defaultStore;

/**
 * A text field that commits each keystroke; invalid text stays visible with its reason and the
 * store never receives it. One focus-to-blur session is one undo step.
 */
function TextField({
  label,
  value,
  commit,
  beginEdit,
  endEdit,
}: {
  label: string;
  value: string;
  commit: (text: string) => string | null;
  beginEdit: () => number;
  endEdit: (token: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const session = useRef(0);
  useEffect(() => () => endEdit(session.current), [endEdit]);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label}
      <input
        type="text"
        value={draft ?? value}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        onFocus={() => (session.current = beginEdit())}
        onChange={(e) => {
          setDraft(e.target.value);
          setError(commit(e.target.value));
        }}
        onBlur={() => {
          endEdit(session.current);
          setDraft(null);
          setError(null);
        }}
      />
      {error && (
        <span id={errorId} role="alert" style={{ color: '#b91c1c', fontSize: 12 }}>
          {error}
        </span>
      )}
    </label>
  );
}

/** Dragging in the color picker fires many changes; focus to blur is one undo step. */
function ColorInput({
  value,
  commit,
  beginEdit,
  endEdit,
}: {
  value: string;
  commit: (color: string) => unknown;
  beginEdit: () => number;
  endEdit: (token: number) => void;
}) {
  const session = useRef(0);
  useEffect(() => () => endEdit(session.current), [endEdit]);
  return (
    <input
      type="color"
      value={value}
      onFocus={() => (session.current = beginEdit())}
      onBlur={() => endEdit(session.current)}
      onChange={(e) => commit(e.target.value)}
    />
  );
}

/** Wireframe 2: "End items" (PR-1) on the left, the selected product's routing (PR-2) beside it. */
export function ProductsPanel({ useStore = defaultStore }: { useStore?: Store }) {
  const { products, addProduct, updateProduct, deleteProduct, beginEdit, endEdit } = useStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = products.find((p) => p.id === selectedId) ?? products[0];
  const { cycleTimes, equipment, technicians } = useStore();
  const issues = preRunIssues({ products, cycleTimes, equipment, technicians });
  const edit = (field: 'partNumber' | 'name') => (text: string) => {
    const r = updateProduct(selected!.id, { [field]: text });
    return r.ok ? null : r.error;
  };

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '280px minmax(0, 1fr) 280px',
        minHeight: '100%',
        font: '14px sans-serif',
      }}
    >
      <section style={{ padding: 16, borderRight: '1px solid #e5e7eb' }}>
        <h2 style={{ fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', margin: 0 }}>
          End items
        </h2>
        <p style={{ color: '#6b7280', marginTop: 2 }}>Products built on this line</p>
        {issues.map((i) => (
          <p key={i.code} style={{ color: '#b45309' }}>
            {i.message}
          </p>
        ))}
        <ul style={{ listStyle: 'none', padding: 0, display: 'grid', gap: 8 }}>
          {products.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => setSelectedId(p.id)}
                aria-pressed={p.id === selected?.id}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: 8,
                  border: p.id === selected?.id ? '2px solid #2563eb' : '1px solid #d1d5db',
                  borderRadius: 6,
                  background: 'white',
                }}
              >
                <span
                  aria-hidden
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    borderRadius: 5,
                    background: p.color,
                    marginRight: 8,
                  }}
                />
                <strong>{p.name}</strong> <span style={{ color: '#6b7280' }}>[{p.partNumber}]</span>
              </button>
            </li>
          ))}
        </ul>
        <button
          onClick={() => setSelectedId(addProduct().id)}
          style={{ width: '100%', padding: 8, marginBottom: 16 }}
        >
          + Add product
        </button>
        {selected && (
          <div key={selected.id} style={{ display: 'grid', gap: 8 }}>
            <TextField
              label="Part number"
              value={selected.partNumber}
              commit={edit('partNumber')}
              beginEdit={beginEdit}
              endEdit={endEdit}
            />
            <TextField
              label="Name"
              value={selected.name}
              commit={edit('name')}
              beginEdit={beginEdit}
              endEdit={endEdit}
            />
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              Color
              <ColorInput
                value={selected.color}
                beginEdit={beginEdit}
                endEdit={endEdit}
                commit={(c) => updateProduct(selected.id, { color: c })}
              />
            </label>
            <button onClick={() => deleteProduct(selected.id)} style={{ color: '#b91c1c' }}>
              Delete product
            </button>
          </div>
        )}
      </section>
      <div style={{ padding: 24, background: '#f9fafb' }}>
        {selected && <RoutingEditor product={selected} useStore={useStore} />}
        <CycleTimeGrid useStore={useStore} />
      </div>
      <div style={{ borderLeft: '1px solid #e5e7eb' }}>
        <DemandPanel useStore={useStore} />
      </div>
    </div>
  );
}
