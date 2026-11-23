import type { Labor } from '@factory-sim/schema';
import type { useEditorStore } from '../layout/editorStore';
import { DurationEditor } from '../products/DurationEditor';

type Store = typeof useEditorStore;

const DEFAULT_HANDLING_TIME = 5;

/**
 * Workstation labor (TE-1): manual (tech present for the whole cycle) or automatic (tech only
 * for load/unload), plus which technicians staff the station.
 */
export function LaborEditor({ equipmentId, useStore }: { equipmentId: string; useStore: Store }) {
  const { equipment, technicians, updateEquipment, setTechnicianStation, beginEdit, endEdit } =
    useStore();
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
      <div key={`${key}-${equipmentId}`} style={{ display: 'grid', gap: 4 }}>
        <span>{label}</span>
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
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend>Mode</legend>
        {(
          [
            ['manual', 'Manual (tech present all cycle)'],
            ['automatic', 'Automatic (tech loads / unloads)'],
          ] as const
        ).map(([mode, text]) => (
          <label key={mode} style={{ display: 'flex', gap: 6 }}>
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
        <div style={{ display: 'flex', gap: 8 }}>
          {timeField('loadTime', 'Load time')}
          {timeField('unloadTime', 'Unload time')}
        </div>
      )}
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend>Assigned techs</legend>
        {technicians.length === 0 && (
          <p style={{ color: '#6b7280', margin: 0 }}>No technicians yet. Add one below.</p>
        )}
        {technicians.map((t) => (
          <label key={t.id} style={{ display: 'flex', gap: 6 }}>
            <input
              type="checkbox"
              checked={t.stationIds.includes(equipmentId)}
              onChange={(e) => setTechnicianStation(t.id, equipmentId, e.target.checked)}
            />
            {t.name}
          </label>
        ))}
      </fieldset>
    </>
  );
}
