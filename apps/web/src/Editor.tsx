import { BASE_EQUIPMENT_TYPES } from '@factory-sim/schema';
import { LibraryPanel } from './equipment/LibraryPanel';
import { LibraryPreview } from './equipment/EquipmentModel';
import { FloorPanel } from './layout/FloorPanel';
import { FloorScene } from './layout/FloorScene';
import { PropertiesPanel } from './layout/PropertiesPanel';
import { ViewToolbar } from './layout/ViewToolbar';
import { useEditorStore } from './layout/editorStore';
import { useEditorShortcuts } from './layout/shortcuts';

export function Editor({ readOnly = false }: { readOnly?: boolean }) {
  const unit = useEditorStore((s) => s.unit);
  const snap = useEditorStore((s) => s.snapEnabled);
  const selectedId = useEditorStore((s) => s.selectedTypeId);
  const selectType = useEditorStore((s) => s.selectType);
  const selected = BASE_EQUIPMENT_TYPES.find((t) => t.id === selectedId);
  useEditorShortcuts(readOnly);
  // Wireframe 1: library left, viewport centre, properties right.
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '260px 1fr 280px',
        height: '100%',
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
