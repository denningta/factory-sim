import { useEffect, useState } from 'react';
import type { useEditorStore } from './editorStore';
import { useEditorStore as defaultStore } from './editorStore';
import { formatNumber, fromDisplay, toDisplay, type DisplayUnit } from './units';

type Store = typeof useEditorStore;

interface FieldProps {
  label: string;
  meters: number;
  unit: DisplayUnit;
  /** Returns an error message, or null when the edit was accepted. */
  onCommit: (meters: number) => string | null;
  /** One focus-to-blur (or Enter) session is one undo step. */
  beginEdit: () => void;
  endEdit: () => void;
}

/** Keeps the typed text while editing so "1." or "" aren't reformatted under the cursor. */
function LengthField({ label, meters, unit, onCommit, beginEdit, endEdit }: FieldProps) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => endEdit, [endEdit]);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label} ({unit})
      <input
        type="text"
        inputMode="decimal"
        value={draft ?? formatNumber(toDisplay(meters, unit))}
        onFocus={beginEdit}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          endEdit();
          beginEdit();
        }}
        onChange={(e) => {
          const text = e.target.value;
          setDraft(text);
          const n = Number(text);
          setError(
            text.trim() === '' || !Number.isFinite(n)
              ? 'Enter a positive number'
              : onCommit(fromDisplay(n, unit)),
          );
        }}
        onBlur={() => {
          endEdit();
          setDraft(null);
          setError(null);
        }}
        aria-invalid={error !== null}
      />
      {error && <span role="alert">{error}</span>}
    </label>
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
    <section aria-label="Floor" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2>Floor</h2>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        Units
        <select value={unit} onChange={(e) => setUnit(e.target.value as DisplayUnit)}>
          <option value="ft">ft</option>
          <option value="m">m</option>
        </select>
      </label>
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
      <label>
        <input type="checkbox" checked={snapEnabled} onChange={toggleSnap} />
        Snap to grid
      </label>
    </section>
  );
}
