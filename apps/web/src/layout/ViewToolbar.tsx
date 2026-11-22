import { useEditorStore as defaultStore } from './editorStore';
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
  return (
    <div style={{ padding: 8, borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 8 }}>
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
    </div>
  );
}
