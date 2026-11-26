import { useEditorStore as defaultStore } from '../layout/editorStore';
import { Field, parseNumber } from '../layout/Field';
import styles from '../layout/panels.module.css';
import { formatNumber, speedFromDisplay, speedToDisplay } from '../layout/units';
import { Button, EmptyState, Section } from '../ui';

type Store = typeof defaultStore;

/** Technicians (TE-1): create, rename, set walk speed (m/s) and remove. Assignment is per station. */
export function TechniciansPanel({ useStore = defaultStore }: { useStore?: Store }) {
  const {
    unit,
    technicians,
    addTechnician,
    updateTechnician,
    deleteTechnician,
    beginEdit,
    endEdit,
  } = useStore();
  return (
    <Section heading="Technicians" collapsible memoryKey="technicians">
      {technicians.length === 0 && <EmptyState title="Add a technician, then assign stations" />}
      {technicians.map((t) => (
        <div key={t.id} className={styles.techRow}>
          <Field
            beginEdit={beginEdit}
            endEdit={endEdit}
            label="Technician name"
            value={t.name}
            commit={(text) => {
              const r = updateTechnician(t.id, { name: text });
              return r.ok ? null : r.error;
            }}
          />
          <Field
            beginEdit={beginEdit}
            endEdit={endEdit}
            label={`Walk speed (${unit === 'ft' ? 'ft/min' : 'm/s'})`}
            value={formatNumber(speedToDisplay(t.walkSpeed, unit))}
            commit={(text) => {
              const n = parseNumber(text);
              if (typeof n === 'string') return n;
              const r = updateTechnician(t.id, { walkSpeed: speedFromDisplay(n, unit) });
              return r.ok ? null : r.error;
            }}
          />
          <Button
            variant="danger"
            onClick={() => deleteTechnician(t.id)}
            aria-label={`Delete ${t.name}`}
          >
            Delete
          </Button>
        </div>
      ))}
      <Button onClick={() => addTechnician()}>Add technician</Button>
    </Section>
  );
}
