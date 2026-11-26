import { BUILT_IN_EQUIPMENT_TYPES } from '@factory-sim/schema';
import { LibrarySection } from './equipment/LibrarySection';
import { api } from './api/client';
import { LibraryPreview } from './equipment/EquipmentModel';
import { FloorEmptyHint } from './layout/FloorEmptyHint';
import { FloorScene } from './layout/FloorScene';
import { RightPanel } from './layout/RightPanel';
import { StatusBar } from './layout/StatusBar';
import { ViewToolbar } from './layout/ViewToolbar';
import { useEditorStore } from './layout/editorStore';
import { useEditorShortcuts } from './layout/shortcuts';
import styles from './Editor.module.css';

export function Editor({
  readOnly = false,
  onOpenProducts,
}: {
  readOnly?: boolean;
  onOpenProducts?: () => void;
}) {
  const unit = useEditorStore((s) => s.unit);
  const selectedId = useEditorStore((s) => s.selectedTypeId);
  const userTypes = useEditorStore((s) => s.userTypes);
  const selected = [...BUILT_IN_EQUIPMENT_TYPES, ...userTypes].find((t) => t.id === selectedId);
  useEditorShortcuts(readOnly);
  return (
    <div className={styles.editor}>
      <aside className={styles.side} aria-label="Library">
        <LibrarySection api={api} unit={unit} />
        {selected ? (
          <LibraryPreview type={selected} />
        ) : (
          <p className={styles.previewHint}>Select a type to preview it in 3D.</p>
        )}
      </aside>
      <main className={styles.main}>
        <ViewToolbar />
        <div className={styles.viewport}>
          <FloorScene />
          <FloorEmptyHint />
        </div>
        <StatusBar />
      </main>
      <aside className={styles.side} aria-label="Properties">
        <RightPanel {...(onOpenProducts ? { onOpenProducts } : {})} />
      </aside>
    </div>
  );
}
