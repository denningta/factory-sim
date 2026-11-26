import { useMemo } from 'react';
import { useEditorStore as defaultStore } from './editorStore';
import { findIssues } from './overlaps';
import styles from './StatusBar.module.css';

/** Units, snap, what is selected and the layout-issue count; the count jumps to the first culprit. */
export function StatusBar({ useStore = defaultStore }: { useStore?: typeof defaultStore }) {
  const unit = useStore((s) => s.unit);
  const snap = useStore((s) => s.snapEnabled);
  const equipment = useStore((s) => s.equipment);
  const clearance = useStore((s) => s.clearance);
  const selectedIds = useStore((s) => s.selectedIds);
  const connectionId = useStore((s) => s.selectedConnectionId);
  const selectEquipment = useStore((s) => s.selectEquipment);
  const issues = useMemo(() => findIssues(equipment, clearance), [equipment, clearance]);
  const first = [...issues.overlaps, ...issues.tooClose][0]?.[0];
  const selected =
    selectedIds.length > 1
      ? `${selectedIds.length} items`
      : selectedIds.length === 1
        ? (equipment.find((e) => e.id === selectedIds[0])?.name ?? 'none')
        : connectionId
          ? 'connection'
          : 'none';
  const label =
    issues.count === 0
      ? 'No layout issues'
      : `${issues.count} layout ${issues.count === 1 ? 'issue' : 'issues'}`;
  return (
    <footer className={styles.bar}>
      <span>Units: {unit}</span>
      <span>Snap: {snap ? 'on' : 'off'}</span>
      <span>Selected: {selected}</span>
      {first === undefined ? (
        <span role="status" className={styles.count}>
          {label}
        </span>
      ) : (
        <button
          type="button"
          className={`${styles.count} ${styles.bad}`}
          title="Select the first flagged object"
          onClick={() => selectEquipment(first, false)}
        >
          {label}
        </button>
      )}
    </footer>
  );
}
