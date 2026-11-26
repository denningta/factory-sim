import type { Labor } from '@factory-sim/schema';
import type { useEditorStore } from '../layout/editorStore';
import { DurationEditor } from '../products/DurationEditor';
import styles from '../layout/panels.module.css';
import { EmptyState } from '../ui';

type Store = typeof useEditorStore;

const DEFAULT_HANDLING_TIME = 5;

/**
 * Workstation labor (TE-1): manual (tech present for the whole cycle) or automatic (tech only
 * for load/unload). Shown in the Process section; staffing is `StaffingEditor`.
 */
export function LaborEditor({ equipmentId, useStore }: { equipmentId: string; useStore: Store }) {
  const { equipment, updateEquipment, beginEdit, endEdit } = useStore();
  const station = equipment.find((e) => e.id === equipmentId);
  if (station?.behavior !== 'workstation') return null;
  const labor: Labor = station.params.labor;
  const setMode = (mode: Labor['mode']) => {
    if (mode === labor.mode) return;
    updateEquipment(equipmentId, {
      labor:
        mode === 'manual'
          ? { mode }
          : {
              mode,
              loadTime: { kind: 'fixed', value: DEFAULT_HANDLING_TIME },
              unloadTime: { kind: 'fixed', value: DEFAULT_HANDLING_TIME },
            },
    });
  };
  const timeField = (key: 'loadTime' | 'unloadTime', label: string) =>
    labor.mode === 'automatic' && (
      <div key={`${key}-${equipmentId}`} className={`${styles.stack} ${styles.durationHost}`}>
        <span className={styles.muted}>{label}</span>
        <DurationEditor
          name={label}
          fixedLabel={`${label} (s)`}
          time={labor[key]}
          setTime={(d) => updateEquipment(equipmentId, { labor: { ...labor, [key]: d } })}
          // Handling times are required, so clearing the field is ignored.
          setFixed={(seconds) =>
            seconds !== null &&
            updateEquipment(equipmentId, {
              labor: { ...labor, [key]: { kind: 'fixed', value: seconds } },
            })
          }
          beginEdit={beginEdit}
          endEdit={endEdit}
        />
      </div>
    );
  return (
    <>
      <fieldset className={styles.choices}>
        <legend>Mode</legend>
        {(
          [
            ['manual', 'Manual (tech present all cycle)'],
            ['automatic', 'Automatic (tech loads / unloads)'],
          ] as const
        ).map(([mode, text]) => (
          <label key={mode} className={styles.choice}>
            <input
              type="radio"
              name={`labor-${equipmentId}`}
              checked={labor.mode === mode}
              onChange={() => setMode(mode)}
            />
            {text}
          </label>
        ))}
      </fieldset>
      {labor.mode === 'automatic' && (
        <div className={styles.stack}>
          {timeField('loadTime', 'Load time')}
          {timeField('unloadTime', 'Unload time')}
        </div>
      )}
    </>
  );
}

/** Which technicians staff a workstation (WS-4). */
export function StaffingEditor({
  equipmentId,
  useStore,
}: {
  equipmentId: string;
  useStore: Store;
}) {
  const { technicians, setTechnicianStation } = useStore();
  if (technicians.length === 0)
    return (
      <EmptyState title="Add a technician, then assign stations">
        Clear the selection to add one.
      </EmptyState>
    );
  return (
    <fieldset className={styles.choices}>
      <legend>Assigned techs</legend>
      {technicians.map((t) => (
        <label key={t.id} className={styles.choice}>
          <input
            type="checkbox"
            checked={t.stationIds.includes(equipmentId)}
            onChange={(e) => setTechnicianStation(t.id, equipmentId, e.target.checked)}
          />
          {t.name}
        </label>
      ))}
    </fieldset>
  );
}
