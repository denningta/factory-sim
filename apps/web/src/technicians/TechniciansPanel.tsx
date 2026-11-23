import { useEditorStore as defaultStore } from '../layout/editorStore';
import { Field, parseNumber } from '../layout/Field';

type Store = typeof defaultStore;

/** Technicians (TE-1): create, rename, set walk speed (m/s) and remove. Assignment is per station. */
export function TechniciansPanel({ useStore = defaultStore }: { useStore?: Store }) {
  const { technicians, addTechnician, updateTechnician, deleteTechnician, beginEdit, endEdit } =
    useStore();
  return (
    <section aria-label="Technicians" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <h2>Technicians</h2>
      {technicians.map((t) => (
        <div key={t.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
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
            label="Walk speed (m/s)"
            value={String(t.walkSpeed)}
            commit={(text) => {
              const n = parseNumber(text);
              if (typeof n === 'string') return n;
              const r = updateTechnician(t.id, { walkSpeed: n });
              return r.ok ? null : r.error;
            }}
          />
          <button onClick={() => deleteTechnician(t.id)} aria-label={`Delete ${t.name}`}>
            Delete
          </button>
        </div>
      ))}
      <button onClick={() => addTechnician()}>Add technician</button>
    </section>
  );
}
