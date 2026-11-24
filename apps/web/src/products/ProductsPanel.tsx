import { useEffect, useRef, useState } from 'react';
import { useEditorStore as defaultStore } from '../layout/editorStore';
import { Button, Field, Section } from '../ui';
import { preRunIssues } from './preRunIssues';
import { CycleTimeGrid } from './CycleTimeGrid';
import { DemandPanel } from './DemandPanel';
import { RoutingEditor } from './RoutingEditor';
import styles from './products.module.css';

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
  const session = useRef(0);
  useEffect(() => () => endEdit(session.current), [endEdit]);
  return (
    <Field
      label={label}
      value={draft ?? value}
      error={error}
      onFocus={() => (session.current = beginEdit())}
      onChange={(text) => {
        setDraft(text);
        setError(commit(text));
      }}
      onBlur={() => {
        endEdit(session.current);
        setDraft(null);
        setError(null);
      }}
    />
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
  const {
    products,
    selectedProductId: selectedId,
    selectProduct: setSelectedId,
    addProduct,
    updateProduct,
    deleteProduct,
    beginEdit,
    endEdit,
  } = useStore();
  const selected = products.find((p) => p.id === selectedId) ?? products[0];
  const { cycleTimes, equipment, technicians } = useStore();
  const issues = preRunIssues({ products, cycleTimes, equipment, technicians });
  const edit = (field: 'partNumber' | 'name') => (text: string) => {
    const r = updateProduct(selected!.id, { [field]: text });
    return r.ok ? null : r.error;
  };

  return (
    <div className={styles.screen}>
      <Section
        className={styles.sidebar}
        heading="End items"
        description="Products built on this line"
      >
        {issues.map((i) => (
          <p key={i.code} className={styles.warning}>
            {i.message}
          </p>
        ))}
        <ul className={styles.productList}>
          {products.map((p) => (
            <li key={p.id}>
              <button
                type="button"
                onClick={() => setSelectedId(p.id)}
                aria-pressed={p.id === selected?.id}
                className={styles.product}
              >
                {/* eslint-disable-next-line no-restricted-syntax -- the swatch is the product's user-chosen colour, data not styling */}
                <span aria-hidden className={styles.swatch} style={{ background: p.color }} />
                <strong>{p.name}</strong> <span className={styles.muted}>[{p.partNumber}]</span>
              </button>
            </li>
          ))}
        </ul>
        <Button className={styles.wide} onClick={() => setSelectedId(addProduct().id)}>
          + Add product
        </Button>
        {selected && (
          <div key={selected.id} className={styles.fields}>
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
            <label className={styles.colorField}>
              Color
              <ColorInput
                value={selected.color}
                beginEdit={beginEdit}
                endEdit={endEdit}
                commit={(c) => updateProduct(selected.id, { color: c })}
              />
            </label>
            <Button variant="danger" onClick={() => deleteProduct(selected.id)}>
              Delete product
            </Button>
          </div>
        )}
      </Section>
      <div className={styles.main}>
        {selected && <RoutingEditor product={selected} useStore={useStore} />}
        <CycleTimeGrid useStore={useStore} />
      </div>
      <div className={styles.demand}>
        <DemandPanel useStore={useStore} />
      </div>
    </div>
  );
}
