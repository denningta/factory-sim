import { FloorPanel } from './layout/FloorPanel';
import { FloorScene } from './layout/FloorScene';
import { useEditorStore } from './layout/editorStore';

export function App() {
  const unit = useEditorStore((s) => s.unit);
  const snap = useEditorStore((s) => s.snapEnabled);
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', height: '100vh' }}>
      <main style={{ display: 'grid', gridTemplateRows: '1fr auto' }}>
        <FloorScene />
        <footer style={{ padding: 8, font: '13px sans-serif' }}>
          Units: {unit} · Snap to grid: {snap ? 'on' : 'off'}
        </footer>
      </main>
      <aside style={{ padding: 16, font: '14px sans-serif' }}>
        <FloorPanel />
      </aside>
    </div>
  );
}
