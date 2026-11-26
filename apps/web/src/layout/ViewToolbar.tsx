import { useEffect, useRef, useState } from 'react';
import { useEditorStore as defaultStore } from './editorStore';
import { formatNumber, fromDisplay, toDisplay } from './units';
import type { ViewMode } from './viewControls';
import { Button } from '../ui';
import styles from './ViewToolbar.module.css';

const SEGMENTS: { mode: ViewMode; label: string }[] = [
  { mode: '3d', label: '3D' },
  { mode: '2d', label: '2D top-down' },
];

/** Viewport toolbar: View (3D/2D, fit) · Edit (undo, redo, delete) · Connect · Clearance. */
export function ViewToolbar({ useStore = defaultStore }: { useStore?: typeof defaultStore }) {
  const requestFit = useStore((s) => s.requestFit);
  const viewMode = useStore((s) => s.viewMode);
  const toggleView = useStore((s) => s.toggleView);
  const clearance = useStore((s) => s.clearance);
  const setClearance = useStore((s) => s.setClearance);
  const unit = useStore((s) => s.unit);
  const beginEdit = useStore((s) => s.beginEdit);
  const endEdit = useStore((s) => s.endEdit);
  const canUndo = useStore((s) => s.canUndo);
  const canRedo = useStore((s) => s.canRedo);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const deleteSelected = useStore((s) => s.deleteSelected);
  const clearSelection = useStore((s) => s.clearSelection);
  const pending = useStore((s) => s.pendingFrom !== null);
  const hasSelection = useStore((s) => s.selectedIds.length > 0 || s.selectedConnectionId !== null);
  // One focus-to-blur typing session is one undo step, not one per keystroke.
  const session = useRef(0);
  useEffect(() => () => endEdit(session.current), [endEdit]);
  // Typed text is kept while editing so "0." or "" aren't reformatted under the cursor.
  const [draft, setDraft] = useState<string | null>(null);
  return (
    <div role="toolbar" aria-label="Layout tools" className={styles.toolbar}>
      <div role="group" aria-label="View" className={styles.group}>
        <div className={styles.segment}>
          {SEGMENTS.map(({ mode, label }) => {
            const active = viewMode === mode;
            return (
              <Button
                key={mode}
                aria-pressed={active}
                title={mode === '3d' ? '3D perspective view' : '2D top-down view'}
                onClick={() => active || toggleView()}
              >
                {label}
              </Button>
            );
          })}
        </div>
        <Button onClick={requestFit} title="Zoom to fit the whole floor">
          Zoom to fit
        </Button>
      </div>
      <div role="group" aria-label="Edit" className={styles.group}>
        <Button disabled={!canUndo} onClick={undo} title="Undo (Ctrl+Z)">
          Undo
        </Button>
        <Button disabled={!canRedo} onClick={redo} title="Redo (Ctrl+Shift+Z)">
          Redo
        </Button>
        <Button
          variant="danger"
          disabled={!hasSelection}
          onClick={deleteSelected}
          title="Delete the selection (Del)"
        >
          Delete
        </Button>
      </div>
      <div role="group" aria-label="Connect" className={styles.group}>
        <span className={styles.hint} title="Click an output port, then an input port">
          {pending ? 'Now click an input' : 'Click ports to link'}
        </span>
        {pending && (
          <Button onClick={clearSelection} title="Cancel connecting (Esc)">
            Cancel
          </Button>
        )}
      </div>
      <div role="group" aria-label="Clearance" className={styles.group}>
        <div className={styles.inline}>
          <input
            type="text"
            inputMode="decimal"
            className={styles.clearance}
            aria-label="Minimum clearance"
            value={draft ?? (clearance === null ? '' : formatNumber(toDisplay(clearance, unit)))}
            placeholder={`Clearance (${unit})`}
            title="Minimum clearance between equipment; leave blank for off"
            onFocus={() => {
              session.current = beginEdit();
            }}
            onChange={(e) => {
              const text = e.target.value;
              setDraft(text);
              const n = Number(text);
              // Blank or invalid means off; the store ignores non-positive values too.
              setClearance(text.trim() !== '' && Number.isFinite(n) ? fromDisplay(n, unit) : null);
            }}
            onBlur={() => {
              endEdit(session.current);
              setDraft(null);
            }}
          />
        </div>
      </div>
    </div>
  );
}
