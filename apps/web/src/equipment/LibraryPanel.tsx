import { BASE_EQUIPMENT_TYPES } from '@factory-sim/schema';
import { formatNumber, toDisplay, type DisplayUnit } from '../layout/units';

interface Props {
  unit: DisplayUnit;
  selectedId: string | null;
  onSelect: (typeId: string) => void;
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
              <small>
                {d(t.footprint.width)} × {d(t.footprint.length)} {unit}
              </small>
              <br />
              <small>
                height {d(t.height)} {unit}
              </small>
              <br />
              <small>behavior: {t.behavior}</small>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
