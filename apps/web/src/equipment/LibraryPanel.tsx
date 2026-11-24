import { BASE_EQUIPMENT_TYPES, type EquipmentType } from '@factory-sim/schema';
import { TYPE_DESCRIPTIONS } from './descriptions';
import { formatNumber, toDisplay, type DisplayUnit } from '../layout/units';

/** dataTransfer key carrying the dragged type's id from the library to the canvas. */
export const EQUIPMENT_DRAG_TYPE = 'application/x-factory-sim-type';

interface Props {
  unit: DisplayUnit;
  selectedId: string | null;
  onSelect: (typeId: string) => void;
  /** My library types (EQ-3), listed after the built-ins. */
  userTypes?: EquipmentType[];
  onEdit?: (type: EquipmentType) => void;
  onDelete?: (type: EquipmentType) => void;
}

/** Built-ins are code constants; my own types (EQ-3) follow them and can be edited or deleted. */
export function LibraryPanel({
  unit,
  selectedId,
  onSelect,
  userTypes = [],
  onEdit,
  onDelete,
}: Props) {
  const d = (m: number) => formatNumber(toDisplay(m, unit));
  return (
    <section aria-label="Equipment library">
      <h2>Library</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
        {[...BASE_EQUIPMENT_TYPES, ...userTypes].map((t) => (
          <li key={t.id} aria-label={t.name}>
            <button
              type="button"
              onClick={() => onSelect(t.id)}
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData(EQUIPMENT_DRAG_TYPE, t.id);
                e.dataTransfer.effectAllowed = 'copy';
                onSelect(t.id);
              }}
              aria-pressed={selectedId === t.id}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: 8,
                borderLeft: `6px solid ${t.color}`,
                outline: selectedId === t.id ? '2px solid #2563eb' : undefined,
              }}
            >
              <strong>{t.name}</strong>
              <br />
              <small>{TYPE_DESCRIPTIONS[t.behavior]}</small>
              <br />
              <small>
                {d(t.footprint.width)} × {d(t.footprint.length)} {unit} · height {d(t.height)}{' '}
                {unit}
              </small>
            </button>
            {userTypes.includes(t) && (
              <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
                <button type="button" onClick={() => onEdit?.(t)} aria-label={`Edit ${t.name}`}>
                  Edit
                </button>
                <button type="button" onClick={() => onDelete?.(t)} aria-label={`Delete ${t.name}`}>
                  Delete
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
