import { useState, type CSSProperties } from 'react';
import { BASE_EQUIPMENT_TYPES, type EquipmentType } from '@factory-sim/schema';
import { TYPE_DESCRIPTIONS } from './descriptions';
import { formatNumber, toDisplay, type DisplayUnit } from '../layout/units';
import { Button, EmptyState, Section } from '../ui';
import styles from './library.module.css';

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

/**
 * Built-ins are code constants; my own types (EQ-3) follow them and can be edited or deleted.
 * A search box filters both groups by name and description.
 */
export function LibraryPanel({
  unit,
  selectedId,
  onSelect,
  userTypes = [],
  onEdit,
  onDelete,
}: Props) {
  const [query, setQuery] = useState('');
  const d = (m: number) => formatNumber(toDisplay(m, unit));
  const q = query.trim().toLowerCase();
  const matches = (t: EquipmentType) =>
    q === '' ||
    t.name.toLowerCase().includes(q) ||
    TYPE_DESCRIPTIONS[t.behavior].toLowerCase().includes(q);
  const base = BASE_EQUIPMENT_TYPES.filter(matches);
  const mine = userTypes.filter(matches);
  const group = (heading: string, types: EquipmentType[], own: boolean) =>
    types.length > 0 && (
      <Section heading={heading}>
        <ul className={styles.list}>
          {types.map((t) => (
            <li key={t.id} aria-label={t.name}>
              <button
                type="button"
                className={styles.type}
                style={{ '--type-color': t.color } as CSSProperties} // eslint-disable-line no-restricted-syntax -- the type's colour is data, not a token
                onClick={() => onSelect(t.id)}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(EQUIPMENT_DRAG_TYPE, t.id);
                  e.dataTransfer.effectAllowed = 'copy';
                  onSelect(t.id);
                }}
                aria-pressed={selectedId === t.id}
              >
                <span className={styles.name}>{t.name}</span>
                <span className={styles.meta}>{TYPE_DESCRIPTIONS[t.behavior]}</span>
                <span className={styles.meta}>
                  {d(t.footprint.width)} × {d(t.footprint.length)} {unit} · height {d(t.height)}{' '}
                  {unit}
                </span>
              </button>
              {own && (
                <div className={styles.actions}>
                  <Button onClick={() => onEdit?.(t)} aria-label={`Edit ${t.name}`}>
                    Edit
                  </Button>
                  <Button
                    variant="danger"
                    onClick={() => onDelete?.(t)}
                    aria-label={`Delete ${t.name}`}
                  >
                    Delete
                  </Button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </Section>
    );
  return (
    <section aria-label="Equipment library" className={styles.library}>
      <input
        type="search"
        className={styles.search}
        aria-label="Search types"
        placeholder="Search types"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {group('Base types', base, false)}
      {group('My equipment', mine, true)}
      {base.length + mine.length === 0 && (
        <EmptyState title="No types match">Clear the search to see every type.</EmptyState>
      )}
    </section>
  );
}
