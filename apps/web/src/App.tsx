import { useState } from 'react';
import { BASE_EQUIPMENT_TYPES } from '@factory-sim/schema';
import { LibraryPanel } from './equipment/LibraryPanel';
import { LibraryPreview } from './equipment/EquipmentModel';
import { FloorPanel } from './layout/FloorPanel';
import { FloorScene } from './layout/FloorScene';
import { useEditorStore } from './layout/editorStore';

export function App() {
  const unit = useEditorStore((s) => s.unit);
  const [selectedId, setSelectedId] = useState<string | null>(BASE_EQUIPMENT_TYPES[0]!.id);
  const selected = BASE_EQUIPMENT_TYPES.find((t) => t.id === selectedId);
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
        <LibraryPanel unit={unit} selectedId={selectedId} onSelect={setSelectedId} />
        {selected && <LibraryPreview type={selected} />}
        <FloorPanel />
      </aside>
    </div>
  );
}
