import { useEditorStore as defaultStore } from './editorStore';
import { EmptyState } from '../ui';
import styles from './FloorEmptyHint.module.css';

/** Sits over the empty floor and tells the user the one thing to do next. */
export function FloorEmptyHint({ useStore = defaultStore }: { useStore?: typeof defaultStore }) {
  const empty = useStore((s) => s.equipment.length === 0);
  if (!empty) return null;
  return (
    <div className={styles.hint}>
      <EmptyState title="Drag a type from the library onto the floor" />
    </div>
  );
}
