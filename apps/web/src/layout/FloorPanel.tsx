import { useEffect, useRef, useState } from 'react';
import type { useEditorStore } from './editorStore';
import { useEditorStore as defaultStore } from './editorStore';
import { Field as UiField, Section } from '../ui';
import styles from './panels.module.css';
import { formatNumber, fromDisplay, toDisplay, type DisplayUnit } from './units';

type Store = typeof useEditorStore;

interface FieldProps {
  label: string;
  meters: number;
  unit: DisplayUnit;
  /** Returns an error message, or null when the edit was accepted. */
  onCommit: (meters: number) => string | null;
  /** One focus-to-blur (or Enter) session is one undo step. */
  beginEdit: () => number;
  endEdit: (token: number) => void;
}

/** Keeps the typed text while editing so "1." or "" aren't reformatted under the cursor. */
function LengthField({ label, meters, unit, onCommit, beginEdit, endEdit }: FieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const session = useRef(0);
  const begin = () => {
    session.current = beginEdit();
  };
  const end = () => endEdit(session.current);
  useEffect(() => () => endEdit(session.current), [endEdit]);
  return (
    <UiField
      label={`${label} (${unit})`}
      type="text"
      inputMode="decimal"
      value={draft ?? formatNumber(toDisplay(meters, unit))}
      error={error}
      onFocus={begin}
      onKeyDown={(e) => {
        if (e.key !== 'Enter') return;
        end();
        begin();
      }}
      onChange={(text) => {
        setDraft(text);
        const n = Number(text);
        setError(
          text.trim() === '' || !Number.isFinite(n)
            ? 'Enter a positive number'
            : onCommit(fromDisplay(n, unit)),
        );
      }}
      onBlur={() => {
        end();
        setDraft(null);
        setError(null);
      }}
    />
  );
}

export function FloorPanel({ useStore = defaultStore }: { useStore?: Store }) {
  const { floor, unit, snapEnabled, setFloor, setUnit, toggleSnap, beginEdit, endEdit } =
    useStore();
  const commit = (key: 'width' | 'length' | 'gridSpacing') => (meters: number) => {
    const r = setFloor({ [key]: meters });
    return r.ok ? null : r.error;
  };
  return (
    <Section heading="Floor" collapsible memoryKey="floor">
      <div className={styles.stack}>
        <UiFieldSelect unit={unit} setUnit={setUnit} />
        <LengthField
          beginEdit={beginEdit}
          endEdit={endEdit}
          label="Floor width"
          meters={floor.width}
          unit={unit}
          onCommit={commit('width')}
        />
        <LengthField
          beginEdit={beginEdit}
          endEdit={endEdit}
          label="Floor length"
          meters={floor.length}
          unit={unit}
          onCommit={commit('length')}
        />
        <LengthField
          beginEdit={beginEdit}
          endEdit={endEdit}
          label="Grid spacing"
          meters={floor.gridSpacing}
          unit={unit}
          onCommit={commit('gridSpacing')}
        />
        <label className={styles.choice}>
          <input type="checkbox" checked={snapEnabled} onChange={toggleSnap} />
          Snap to grid
        </label>
      </div>
    </Section>
  );
}

function UiFieldSelect({
  unit,
  setUnit,
}: {
  unit: DisplayUnit;
  setUnit: (u: DisplayUnit) => void;
}) {
  return (
    <label className={styles.stack}>
      <span className={styles.muted}>Units</span>
      <select
        className={styles.select}
        value={unit}
        onChange={(e) => setUnit(e.target.value as DisplayUnit)}
      >
        <option value="ft">ft</option>
        <option value="m">m</option>
      </select>
    </label>
  );
}
