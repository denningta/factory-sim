import { useEditorStore as defaultStore } from './editorStore';
import { FloorPanel } from './FloorPanel';
import { PropertiesPanel } from './PropertiesPanel';
import { TechniciansPanel } from '../technicians/TechniciansPanel';
import styles from './panels.module.css';

/**
 * The right panel shows only what fits the selection: floor and technician settings when nothing
 * is selected, the object's properties when equipment or a connection is.
 */
export function RightPanel({
  useStore = defaultStore,
  onOpenProducts,
}: {
  useStore?: typeof defaultStore;
  onOpenProducts?: () => void;
}) {
  const hasSelection = useStore((s) => s.selectedIds.length > 0 || s.selectedConnectionId !== null);
  if (hasSelection)
    return <PropertiesPanel useStore={useStore} {...(onOpenProducts ? { onOpenProducts } : {})} />;
  return (
    <div className={styles.panel}>
      <FloorPanel useStore={useStore} />
      <TechniciansPanel useStore={useStore} />
    </div>
  );
}
