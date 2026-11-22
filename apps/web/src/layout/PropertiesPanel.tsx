import { useId, useState } from 'react';
import { useEditorStore as defaultStore } from './editorStore';
import { BASE_EQUIPMENT_TYPES } from '@factory-sim/schema';
import { formatLength, formatNumber, fromDisplay, toDisplay } from './units';

type Store = typeof defaultStore;

const toDegrees = (rad: number) => (rad * 180) / Math.PI;

/**
 * A text field that commits each keystroke through `commit`, which returns an error reason or
 * null. Invalid text stays visible with its reason; the store never receives it. On blur the
 * field reverts to the stored value.
 */
function Field({
  label,
  value,
  commit,
  extraError,
  onBlur,
}: {
  label: string;
  value: string;
  commit: (text: string) => string | null;
  /** A reason set from outside, e.g. the other field of a rule that spans two fields. */
  extraError?: string | null;
  onBlur?: () => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const shown = error ?? extraError ?? null;
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 }}>
      {label}
      <input
        type="text"
        inputMode="decimal"
        value={draft ?? value}
        aria-invalid={shown ? 'true' : undefined}
        aria-describedby={shown ? errorId : undefined}
        onChange={(e) => {
          setDraft(e.target.value);
          setError(commit(e.target.value));
        }}
        onBlur={() => {
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
function parseNumber(text: string): number | string {
  const n = Number(text);
  return text.trim() === '' || !Number.isFinite(n) ? 'Enter a number' : n;
}

const PARAM_LABELS: Record<string, string> = {
  capacity: 'Capacity (units)',
  batchSize: 'Batch size (units)',
  speed: 'Speed (m/s)',
};

export function PropertiesPanel({ useStore = defaultStore }: { useStore?: Store }) {
  const {
    equipment,
    selectedIds,
    unit,
    rotateSelected,
    setSelectedRotation,
    updateEquipment,
    deleteSelected,
  } = useStore();
  /** Set when a params edit breaks a rule on another field, so both fields show the reason. */
  const [linked, setLinked] = useState<{ key: string; message: string } | null>(null);
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
      {single ? (
        <>
          <Field
            key={`name-${first.id}`}
            label="Name"
            value={first.name}
            commit={(t) => {
              const r = updateEquipment(first.id, { name: t });
              return r.ok ? null : r.error;
            }}
          />
          <p style={{ margin: 0 }}>
            Type:{' '}
            <span data-testid="type">
              {BASE_EQUIPMENT_TYPES.find((t) => t.id === first.typeId)?.name ?? first.typeId}
            </span>
          </p>
          {/* Read-only here; editing dimensions is EQ-2. */}
          <p style={{ margin: 0 }}>
            Dimensions:{' '}
            <span data-testid="dimensions">
              {[first.footprint.width, first.footprint.length, first.height]
                .map((m) => formatNumber(toDisplay(m, unit)))
                .join(' × ')}{' '}
              {unit} (W × L × H)
            </span>
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['x', 'y'] as const).map((axis) => (
              <Field
                key={`${axis}-${first.id}`}
                label={`Position ${axis.toUpperCase()} (${unit})`}
                value={pos(first.position[axis])}
                commit={(t) => {
                  const n = parseNumber(t);
                  if (typeof n === 'string') return n;
                  const r = updateEquipment(first.id, {
                    position: { [axis]: fromDisplay(n, unit) },
                  });
                  if (r.ok) return null;
                  // The store words bounds in meters; say it in the display unit.
                  return r.bounds
                    ? `${axis.toUpperCase()} must be on the floor (0 to ${formatLength(r.bounds.max, unit)})`
                    : r.error;
                }}
              />
            ))}
          </div>
          {Object.entries(first.params).map(([key, v]) => (
            <Field
              key={`${key}-${first.id}`}
              label={PARAM_LABELS[key] ?? key}
              value={String(v)}
              commit={(t) => {
                const n = parseNumber(t);
                if (typeof n === 'string') return n;
                const r = updateEquipment(first.id, { params: { [key]: n } });
                setLinked(
                  !r.ok && r.field && r.field !== key ? { key: r.field, message: r.error } : null,
                );
                return r.ok ? null : r.error;
              }}
              extraError={linked?.key === key ? linked.message : null}
              onBlur={() => setLinked(null)}
            />
          ))}
        </>
      ) : (
        <p style={{ margin: 0 }}>
          <strong>{`${selected.length} selected`}</strong>
        </p>
      )}
      {/* Keyed by selection so the field re-reads when the selection changes. */}
      <Field
        key={`rot-${selectedIds.join(',')}`}
        label="Rotation (°)"
        value={formatNumber(same ? toDegrees(first.rotation) : 0)}
        commit={(t) => {
          const n = parseNumber(t);
          if (typeof n === 'string') return n;
          setSelectedRotation(n);
          return null;
        }}
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
