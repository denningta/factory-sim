import { useEditorStore as defaultStore } from './editorStore';

/** Wireframe 1's viewport toolbar: zoom to fit and the 3D / 2D top-down toggle. */
export function ViewToolbar({ useStore = defaultStore }: { useStore?: typeof defaultStore }) {
  const requestFit = useStore((s) => s.requestFit);
  const viewMode = useStore((s) => s.viewMode);
  const toggleView = useStore((s) => s.toggleView);
  return (
    <div style={{ padding: 8, borderBottom: '1px solid #e5e7eb', display: 'flex', gap: 8 }}>
      <button type="button" onClick={toggleView}>
        {viewMode === '3d' ? '2D top-down' : '3D view'}
      </button>
      <button type="button" onClick={requestFit}>
        Zoom to fit
      </button>
    </div>
  );
}
