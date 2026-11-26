import type { Duration, WorkstationCycle } from '@factory-sim/schema';
import { formatNumber } from './units';
import { Field, parseNumber } from './Field';
import type { useEditorStore } from './editorStore';
import styles from './panels.module.css';

type Store = typeof useEditorStore;

/** Cure times run for hours, so they are shown in minutes; the store keeps seconds. */
export const SECONDS_PER_MINUTE = 60;
const DEFAULT_CURE_SECONDS = 7200;

/** The one number that stands for a duration in a field: the fixed value, else its center. */
export function typicalSeconds(d: Duration): number {
  return d.kind === 'fixed' ? d.value : d.kind === 'triangular' ? d.mode : d.mean;
}

/**
 * Workstation cycle (SF-0, SF-7): per product (times come from the routing's cycle-time grid)
 * or one fixed cure per batch, with the batch's max wait. Batch size is a plain numeric
 * param, edited with the others.
 */
export function CycleEditor({ equipmentId, useStore }: { equipmentId: string; useStore: Store }) {
  const { equipment, updateEquipment, beginEdit, endEdit } = useStore();
  const station = equipment.find((e) => e.id === equipmentId);
  if (station?.behavior !== 'workstation') return null;
  const { cycle, maxWait } = station.params;
  const mode = cycle?.mode ?? 'perProduct';
  const setMode = (next: WorkstationCycle['mode']) => {
    if (next === mode) return;
    updateEquipment(equipmentId, {
      cycle:
        next === 'perProduct'
          ? { mode: 'perProduct' }
          : { mode: 'perBatch', time: { kind: 'fixed', value: DEFAULT_CURE_SECONDS } },
    });
  };
  return (
    <>
      <label className={styles.stack}>
        Cycle
        <select value={mode} onChange={(e) => setMode(e.target.value as WorkstationCycle['mode'])}>
          <option value="perProduct">Per product</option>
          <option value="perBatch">Per batch (cure)</option>
        </select>
      </label>
      {cycle?.mode === 'perBatch' && (
        <Field
          key={`cure-${equipmentId}`}
          beginEdit={beginEdit}
          endEdit={endEdit}
          label="Cure time (min)"
          value={formatNumber(typicalSeconds(cycle.time) / SECONDS_PER_MINUTE)}
          commit={(t) => {
            const n = parseNumber(t);
            if (typeof n === 'string') return n;
            if (n <= 0) return 'Cure time must be greater than 0';
            const r = updateEquipment(equipmentId, {
              cycle: {
                mode: 'perBatch',
                time: { kind: 'fixed', value: n * SECONDS_PER_MINUTE },
              },
            });
            return r.ok ? null : r.error;
          }}
        />
      )}
      <Field
        key={`wait-${equipmentId}`}
        beginEdit={beginEdit}
        endEdit={endEdit}
        label="Max wait (min)"
        placeholder="Wait for a full batch"
        value={maxWait === undefined ? '' : formatNumber(maxWait / SECONDS_PER_MINUTE)}
        commit={(t) => {
          if (t.trim() === '') {
            updateEquipment(equipmentId, { maxWait: null });
            return null;
          }
          const n = parseNumber(t);
          if (typeof n === 'string') return n;
          if (n <= 0) return 'Max wait must be greater than 0';
          const r = updateEquipment(equipmentId, { maxWait: n * SECONDS_PER_MINUTE });
          return r.ok ? null : r.error;
        }}
      />
    </>
  );
}
