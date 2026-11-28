import { useState } from 'react';
import { useEditorStore as defaultStore } from '../layout/editorStore';
import { parseCycleTimeTable, stationsOf } from './cycleTimes';
import { Button } from '../ui';
import { DurationEditor } from './DurationEditor';
import styles from './products.module.css';

type Store = typeof defaultStore;

/** Wireframe 2, "Cycle times": product × station grid, editable only where a routing uses the station (PR-3). */
export function CycleTimeGrid({ useStore = defaultStore }: { useStore?: Store }) {
  const products = useStore((s) => s.products);
  const equipment = useStore((s) => s.equipment);
  const cycleTimes = useStore((s) => s.cycleTimes);
  const setCycleTime = useStore((s) => s.setCycleTime);
  const setCycleTimeDuration = useStore((s) => s.setCycleTimeDuration);
  const importCycleTimes = useStore((s) => s.importCycleTimes);
  const copied = useStore((s) => s.copiedCycleTimes);
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
    <section aria-labelledby="cycle-times-heading" className={styles.cycleTimes}>
      <h2 id="cycle-times-heading" className={styles.h2}>
        Cycle times
      </h2>
      {stations.length === 0 ? (
        <p className={styles.muted}>
          Add routing steps to a product, then enter its cycle time at each station here.
        </p>
      ) : (
        <>
          <p className={styles.muted}>
            Seconds, or mm:ss. Pick a distribution to model variability; samples below 0 are cut
            off. Highlighted cells still need a time.
          </p>
          <div className={styles.tableScroll}>
            <table aria-label="Cycle times" className={styles.grid}>
              <thead>
                <tr>
                  <th scope="col" className={styles.cellLeft}>
                    Product
                  </th>
                  {stations.map((s) => (
                    <th key={s.id} scope="col" className={styles.cellRight}>
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
                      <th scope="row" className={styles.rowHead}>
                        {p.name} <span className={styles.muted}>[{p.partNumber}]</span>
                      </th>
                      {stations.map((s) =>
                        own.has(s.id) ? (
                          <td key={s.id} className={styles.cellRight}>
                            <DurationEditor
                              name={`${p.name} at ${s.name}`}
                              fixedLabel={`Cycle time, ${p.name} at ${s.name}`}
                              time={timeOf(p.id, s.id)}
                              setTime={(d) => setCycleTimeDuration(p.id, s.id, d)}
                              setFixed={(seconds) => setCycleTime(p.id, s.id, seconds)}
                              beginEdit={beginEdit}
                              endEdit={endEdit}
                            />
                            {copied.includes(`${p.id}\u0000${s.id}`) && (
                              <span className={styles.copiedNote}>
                                copied from{' '}
                                {equipment.find(
                                  (e) =>
                                    e.id ===
                                    p.routing.find((r) => r.alternates?.includes(s.id))?.stationId,
                                )?.name ?? 'primary'}
                                : change if different
                              </span>
                            )}
                          </td>
                        ) : (
                          <td
                            key={s.id}
                            aria-label={`${p.name} does not use ${s.name}`}
                            className={styles.cellNotRouted}
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
          <details className={styles.import}>
            <summary className={styles.summary}>Import from CSV or Excel</summary>
            <div className={styles.importBody}>
              <p className={styles.muted}>
                First row: station names. First column: exact part numbers (case-sensitive). Copy
                the cells from Excel and paste, or choose a CSV file.
              </p>
              <label className={styles.selectField}>
                Paste cycle times
                <textarea
                  rows={5}
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  className={styles.paste}
                />
              </label>
              <div className={styles.importActions}>
                <Button disabled={pasted.trim() === ''} onClick={() => runImport(pasted)}>
                  Import
                </Button>
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
      <div role="status" className={styles.report}>
        {report && (
          <>
            <p className={styles.reportText}>
              Imported {report.imported} cycle time{report.imported === 1 ? '' : 's'}.
              {report.errors.length > 0 && ` Skipped ${report.errors.length}:`}
            </p>
            <ul className={styles.reportErrors}>
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
