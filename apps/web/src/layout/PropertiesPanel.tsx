import { useState } from 'react';
import { useEditorStore as defaultStore } from './editorStore';
import { formatNumber, toDisplay } from './units';

type Store = typeof defaultStore;

const toDegrees = (rad: number) => (rad * 180) / Math.PI;

/** Keeps the typed text while editing so "4." or "" aren't reformatted under the cursor. */
function AngleField({ degrees, onCommit }: { degrees: number; onCommit: (d: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      Rotation (°)
      <input
        type="text"
        inputMode="decimal"
        value={draft ?? formatNumber(degrees)}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = Number(e.target.value);
          if (e.target.value.trim() !== '' && Number.isFinite(n)) onCommit(n);
        }}
        onBlur={() => setDraft(null)}
      />
    </label>
  );
}

export function PropertiesPanel({ useStore = defaultStore }: { useStore?: Store }) {
  const { equipment, selectedIds, unit, rotateSelected, setSelectedRotation, deleteSelected } =
    useStore();
  const selected = equipment.filter((e) => selectedIds.includes(e.id));
  const first = selected[0];
  if (!first) {
    return (
      <section aria-label="Properties">
        <h2>Properties</h2>
        <p style={{ color: '#6b7280' }}>Select equipment on the floor to edit it.</p>
      </section>
    );
  }
  const single = selected.length === 1;
  const same = selected.every((e) => e.rotation === first.rotation);
  const pos = (m: number) => formatNumber(toDisplay(m, unit));
  return (
    <section aria-label="Properties" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2>Properties</h2>
      <p style={{ margin: 0 }}>
        <strong>{single ? first.name : `${selected.length} selected`}</strong>
      </p>
      {single && (
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
            Position X ({unit})
            <input readOnly value={pos(first.position.x)} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
            Position Y ({unit})
            <input readOnly value={pos(first.position.y)} />
          </label>
        </div>
      )}
      {/* Keyed by selection so the field re-reads when the selection changes. */}
      <AngleField
        key={selectedIds.join(',')}
        degrees={same ? toDegrees(first.rotation) : 0}
        onCommit={setSelectedRotation}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={() => rotateSelected(-90)}>
          Rotate −90°
        </button>
        <button type="button" onClick={() => rotateSelected(90)}>
          Rotate 90°
        </button>
      </div>
      <button type="button" onClick={deleteSelected}>
        Delete
      </button>
    </section>
  );
}
