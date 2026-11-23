import { useState } from 'react';
import { useEditorStore as defaultStore } from '../layout/editorStore';
import { parseCycleTimeTable, stationsOf } from './cycleTimes';
import { DurationEditor } from './DurationEditor';

type Store = typeof defaultStore;

const cellStyle = { padding: '6px 10px', borderBottom: '1px solid #e5e7eb' } as const;

/** Wireframe 2, "Cycle times": product × station grid, editable only where a routing uses the station (PR-3). */
export function CycleTimeGrid({ useStore = defaultStore }: { useStore?: Store }) {
  const products = useStore((s) => s.products);
  const equipment = useStore((s) => s.equipment);
  const cycleTimes = useStore((s) => s.cycleTimes);
  const setCycleTime = useStore((s) => s.setCycleTime);
  const setCycleTimeDuration = useStore((s) => s.setCycleTimeDuration);
  const importCycleTimes = useStore((s) => s.importCycleTimes);
  const beginEdit = useStore((s) => s.beginEdit);
  const endEdit = useStore((s) => s.endEdit);
  const [pasted, setPasted] = useState('');
  const [report, setReport] = useState<{ imported: number; errors: string[] } | null>(null);

  const used = new Set(products.flatMap(stationsOf));
  const stations = equipment.filter((e) => e.behavior === 'workstation' && used.has(e.id));
  const timeOf = (productId: string, stationId: string) =>
    cycleTimes.find((c) => c.productId === productId && c.stationId === stationId)?.time ?? null;

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
            Seconds, or mm:ss. Pick a distribution to model variability; samples below 0 are cut
            off. Highlighted cells still need a time.
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
                            <DurationEditor
                              name={`${p.name} at ${s.name}`}
                              fixedLabel={`Cycle time, ${p.name} at ${s.name}`}
                              time={timeOf(p.id, s.id)}
                              setTime={(d) => setCycleTimeDuration(p.id, s.id, d)}
                              setFixed={(seconds) => setCycleTime(p.id, s.id, seconds)}
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
                            not routed
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
                First row: station names. First column: exact part numbers (case-sensitive). Copy
                the cells from Excel and paste, or choose a CSV file.
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
