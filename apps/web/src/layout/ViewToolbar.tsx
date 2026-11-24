import { useMemo } from 'react';
import { useEditorStore as defaultStore } from './editorStore';
import { findIssues } from './overlaps';
import { formatNumber, fromDisplay, toDisplay } from './units';
import type { ViewMode } from './viewControls';

const SEGMENTS: { mode: ViewMode; label: string }[] = [
  { mode: '3d', label: '3D' },
  { mode: '2d', label: '2D top-down' },
];

/** Wireframe 1's viewport toolbar: a 3D | 2D top-down segmented control and zoom to fit. */
export function ViewToolbar({ useStore = defaultStore }: { useStore?: typeof defaultStore }) {
  const requestFit = useStore((s) => s.requestFit);
  const viewMode = useStore((s) => s.viewMode);
  const toggleView = useStore((s) => s.toggleView);
  const equipment = useStore((s) => s.equipment);
  const clearance = useStore((s) => s.clearance);
  const setClearance = useStore((s) => s.setClearance);
  const unit = useStore((s) => s.unit);
  const issues = useMemo(() => findIssues(equipment, clearance).count, [equipment, clearance]);
  return (
    <div
      style={{
        padding: 8,
        alignItems: 'center',
        borderBottom: '1px solid #e5e7eb',
        display: 'flex',
        gap: 8,
      }}
    >
      <div role="group" aria-label="View" style={{ display: 'flex' }}>
        {SEGMENTS.map(({ mode, label }) => {
          const active = viewMode === mode;
          return (
            <button
              key={mode}
              type="button"
              aria-pressed={active}
              onClick={() => active || toggleView()}
              style={{
                background: active ? '#1f2937' : undefined,
                color: active ? '#fff' : undefined,
              }}
            >
              {label}
            </button>
          );
        })}
      </div>
      <button type="button" onClick={requestFit}>
        Zoom to fit
      </button>
      <label style={{ display: 'flex', gap: 4, alignItems: 'center', font: '13px sans-serif' }}>
        Min clearance ({unit})
        <input
          type="number"
          min={0}
          step="any"
          aria-label="Minimum clearance"
          style={{ width: 64 }}
          value={clearance === null ? '' : formatNumber(toDisplay(clearance, unit))}
          placeholder="off"
          onChange={(e) => {
            const v = e.target.valueAsNumber;
            setClearance(Number.isFinite(v) ? fromDisplay(v, unit) : null);
          }}
        />
      </label>
      <span
        role="status"
        style={{
          font: '13px sans-serif',
          color: issues ? '#b91c1c' : '#4b5563',
          marginLeft: 'auto',
        }}
      >
        {issues === 0
          ? 'No layout issues'
          : `${issues} layout ${issues === 1 ? 'issue' : 'issues'}`}
      </span>
    </div>
  );
}
