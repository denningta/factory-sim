import { useEffect, useId, useRef, useState } from 'react';
import { useEditorStore as defaultStore } from '../layout/editorStore';
import { parseCycleTimeTable, parseDuration, stationsOf } from './cycleTimes';

type Store = typeof defaultStore;

const cellStyle = { padding: '6px 10px', borderBottom: '1px solid #e5e7eb' } as const;

/**
 * One grid cell. Valid text commits as you type; invalid text stays visible with its reason and
 * never reaches the store. Empty clears the cell. A focus-to-blur session is one undo step.
 */
function TimeCell({
  label,
  value,
  commit,
  beginEdit,
  endEdit,
}: {
  label: string;
  /** Stored seconds, or null while the cell is empty. */
  value: number | null;
  commit: (seconds: number | null) => void;
  beginEdit: () => number;
  endEdit: (token: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const errorId = useId();
  const session = useRef(0);
  useEffect(() => () => endEdit(session.current), [endEdit]);
  const missing = value === null && draft === null;
  return (
    <>
      <input
        type="text"
        inputMode="decimal"
        aria-label={label}
        aria-invalid={error || missing ? 'true' : undefined}
        aria-describedby={error ? errorId : undefined}
        placeholder="sec"
        value={draft ?? (value === null ? '' : String(value))}
        onFocus={() => (session.current = beginEdit())}
        onChange={(e) => {
          const text = e.target.value;
          setDraft(text);
          if (text.trim() === '') {
            setError(null);
            return commit(null);
          }
          const seconds = parseDuration(text);
          if (seconds === null) return setError('Enter seconds or mm:ss, greater than 0');
          setError(null);
          commit(seconds);
        }}
        onBlur={() => {
          endEdit(session.current);
          setDraft(null);
          setError(null);
        }}
        style={{
          width: 72,
          padding: 4,
          textAlign: 'right',
          borderColor: error ? '#b91c1c' : missing ? '#f59e0b' : undefined,
        }}
      />
      {error && (
        <div id={errorId} role="alert" style={{ color: '#b91c1c', fontSize: 12 }}>
          {error}
        </div>
      )}
    </>
  );
}

/** Wireframe 2, "Cycle times": product × station grid, editable only where a routing uses the station (PR-3). */
export function CycleTimeGrid({ useStore = defaultStore }: { useStore?: Store }) {
  const products = useStore((s) => s.products);
  const equipment = useStore((s) => s.equipment);
  const cycleTimes = useStore((s) => s.cycleTimes);
  const setCycleTime = useStore((s) => s.setCycleTime);
  const importCycleTimes = useStore((s) => s.importCycleTimes);
  const beginEdit = useStore((s) => s.beginEdit);
  const endEdit = useStore((s) => s.endEdit);
  const [pasted, setPasted] = useState('');
  const [report, setReport] = useState<{ imported: number; errors: string[] } | null>(null);

  const used = new Set(products.flatMap(stationsOf));
  const stations = equipment.filter((e) => e.behavior === 'workstation' && used.has(e.id));
  const timeOf = (productId: string, stationId: string) => {
    const t = cycleTimes.find((c) => c.productId === productId && c.stationId === stationId)?.time;
    return t?.kind === 'fixed' ? t.value : null;
  };

  const runImport = (text: string) => {
    const { entries, errors } = parseCycleTimeTable(text, { products, equipment });
    importCycleTimes(entries);
    setReport({ imported: entries.length, errors });
    if (entries.length > 0) setPasted('');
  };

  return (
    <section
      aria-labelledby="cycle-times-heading"
      style={{ display: 'grid', gap: 8, marginTop: 32 }}
    >
      <h2 id="cycle-times-heading" style={{ fontSize: 18, margin: 0 }}>
        Cycle times
      </h2>
      {stations.length === 0 ? (
        <p style={{ color: '#6b7280', margin: 0 }}>
          Add routing steps to a product, then enter its cycle time at each station here.
        </p>
      ) : (
        <>
          <p style={{ color: '#6b7280', margin: 0 }}>
            Seconds, or mm:ss. Highlighted cells still need a time.
          </p>
          <div style={{ overflowX: 'auto' }}>
            <table
              aria-label="Cycle times"
              style={{ borderCollapse: 'collapse', background: 'white', font: '14px sans-serif' }}
            >
              <thead>
                <tr>
                  <th scope="col" style={{ ...cellStyle, textAlign: 'left' }}>
                    Product
                  </th>
                  {stations.map((s) => (
                    <th key={s.id} scope="col" style={{ ...cellStyle, textAlign: 'right' }}>
                      {s.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const own = new Set(stationsOf(p));
                  return (
                    <tr key={p.id}>
                      <th scope="row" style={{ ...cellStyle, textAlign: 'left', fontWeight: 600 }}>
                        {p.name} <span style={{ color: '#6b7280' }}>[{p.partNumber}]</span>
                      </th>
                      {stations.map((s) =>
                        own.has(s.id) ? (
                          <td key={s.id} style={{ ...cellStyle, textAlign: 'right' }}>
                            <TimeCell
                              label={`Cycle time, ${p.name} at ${s.name}`}
                              value={timeOf(p.id, s.id)}
                              commit={(seconds) => setCycleTime(p.id, s.id, seconds)}
                              beginEdit={beginEdit}
                              endEdit={endEdit}
                            />
                          </td>
                        ) : (
                          <td
                            key={s.id}
                            aria-label={`${p.name} does not use ${s.name}`}
                            style={{
                              ...cellStyle,
                              textAlign: 'center',
                              color: '#9ca3af',
                              background: '#f3f4f6',
                            }}
                          >
                            —
                          </td>
                        ),
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: 'pointer' }}>Import from CSV or Excel</summary>
            <div style={{ display: 'grid', gap: 8, padding: '8px 0', maxWidth: 560 }}>
              <p style={{ color: '#6b7280', margin: 0 }}>
                First row: station names. First column: part numbers. Copy the cells from Excel and
                paste, or choose a CSV file.
              </p>
              <label style={{ display: 'grid', gap: 4 }}>
                Paste cycle times
                <textarea
                  rows={5}
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  style={{ font: '13px monospace' }}
                />
              </label>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                <button disabled={pasted.trim() === ''} onClick={() => runImport(pasted)}>
                  Import
                </button>
                <input
                  type="file"
                  accept=".csv,.tsv,.txt,text/csv,text/plain"
                  aria-label="Import CSV file"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void file.text().then(runImport);
                  }}
                />
              </div>
            </div>
          </details>
        </>
      )}
      <div role="status" style={{ fontSize: 13 }}>
        {report && (
          <>
            <p style={{ margin: 0 }}>
              Imported {report.imported} cycle time{report.imported === 1 ? '' : 's'}.
              {report.errors.length > 0 && ` Skipped ${report.errors.length}:`}
            </p>
            <ul style={{ color: '#b45309', margin: '4px 0 0', paddingLeft: 18 }}>
              {report.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
