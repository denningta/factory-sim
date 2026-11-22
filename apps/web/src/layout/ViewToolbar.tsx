import { useEditorStore as defaultStore } from './editorStore';

/** Wireframe 1's viewport toolbar; only "Zoom to fit" exists so far. */
export function ViewToolbar({ useStore = defaultStore }: { useStore?: typeof defaultStore }) {
  const requestFit = useStore((s) => s.requestFit);
  return (
    <div style={{ padding: 8, borderBottom: '1px solid #e5e7eb' }}>
      <button type="button" onClick={requestFit}>
        Zoom to fit
      </button>
    </div>
  );
}
