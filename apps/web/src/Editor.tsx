import { useEffect } from 'react';
import { BASE_EQUIPMENT_TYPES } from '@factory-sim/schema';
import { LibraryPanel } from './equipment/LibraryPanel';
import { LibraryPreview } from './equipment/EquipmentModel';
import { FloorPanel } from './layout/FloorPanel';
import { FloorScene } from './layout/FloorScene';
import { PropertiesPanel } from './layout/PropertiesPanel';
import { ViewToolbar } from './layout/ViewToolbar';
import { useEditorStore } from './layout/editorStore';

export function Editor() {
  const unit = useEditorStore((s) => s.unit);
  const snap = useEditorStore((s) => s.snapEnabled);
  const selectedId = useEditorStore((s) => s.selectedTypeId);
  const selectType = useEditorStore((s) => s.selectType);
  const selected = BASE_EQUIPMENT_TYPES.find((t) => t.id === selectedId);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target;
      if (t instanceof HTMLElement && /^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName)) return;
      if (e.key === 'Delete' || e.key === 'Backspace') useEditorStore.getState().deleteSelected();
      if (e.key === 'Escape') useEditorStore.getState().clearSelection();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  // Wireframe 1: library left, viewport centre, properties right.
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr 280px',
        height: '100vh',
        minHeight: 0,
      }}
    >
      <aside style={{ padding: 16, font: '14px sans-serif', overflowY: 'auto', minHeight: 0 }}>
        <LibraryPanel unit={unit} selectedId={selectedId} onSelect={selectType} />
        {selected ? (
          <LibraryPreview type={selected} />
        ) : (
          <p style={{ color: '#6b7280' }}>Select a type to preview it in 3D.</p>
        )}
      </aside>
      <main style={{ display: 'grid', gridTemplateRows: 'auto minmax(0, 1fr) auto', minHeight: 0 }}>
        <ViewToolbar />
        <FloorScene />
        <footer style={{ padding: 8, font: '13px sans-serif' }}>
          Units: {unit} · Snap to grid: {snap ? 'on' : 'off'}
        </footer>
      </main>
      <aside style={{ padding: 16, font: '14px sans-serif', overflowY: 'auto', minHeight: 0 }}>
        <PropertiesPanel />
        <FloorPanel />
      </aside>
    </div>
  );
}
