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

/** Built-ins are code constants until the library table arrives with EQ-3. */
export function LibraryPanel({ unit, selectedId, onSelect }: Props) {
  const d = (m: number) => formatNumber(toDisplay(m, unit));
  return (
    <section aria-label="Equipment library">
      <h2>Library</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
        {BASE_EQUIPMENT_TYPES.map((t) => (
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
          </li>
        ))}
      </ul>
    </section>
  );
}
