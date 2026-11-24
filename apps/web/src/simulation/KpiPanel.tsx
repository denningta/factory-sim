import { useEffect, useState } from 'react';
import { computeKpis, type KpiRow } from './kpis';
import type { RunSession } from './runSession';

const num = (v: number) => v.toFixed(1);
const minutes = (s: number | null) => (s === null ? '–' : (s / 60).toFixed(1));

/** Wireframe 3, live KPIs: per product and total, from the engine's warm-up-free stats. */
export function KpiPanel({
  session,
  products,
  shiftLength,
}: {
  session: RunSession;
  products: { id: string; name: string }[];
  shiftLength: number;
}) {
  const read = () => computeKpis(session.stats(), products, shiftLength);
  const [kpis, setKpis] = useState(read);
  // Like the clock, the figures are text: poll a few times a second rather than per frame.
  // The final read on 'done' (subscribe) keeps the end-of-run values exact.
  useEffect(() => {
    setKpis(read());
    const id = setInterval(() => setKpis(read()), 200);
    const unsub = session.subscribe(() => setKpis(read()));
    return () => {
      clearInterval(id);
      unsub();
    };
  }, [session, products, shiftLength]);
  const cell = { padding: '2px 6px', textAlign: 'right' as const };
  const line = (r: KpiRow) => (
    <tr key={r.id} aria-label={r.name} style={r.id === 'total' ? { fontWeight: 600 } : undefined}>
      <th scope="row" style={{ ...cell, textAlign: 'left', fontWeight: 'inherit' }}>
        {r.name}
      </th>
      <td style={cell}>{num(r.throughputPerHour)}</td>
      <td style={cell}>{num(r.throughputPerShift)}</td>
      <td style={cell}>{num(r.averageWip)}</td>
      <td style={cell}>{minutes(r.leadTime)}</td>
    </tr>
  );
  return (
    <section aria-label="Live KPIs" style={{ padding: 12, font: '13px sans-serif' }}>
      <h2 style={{ font: 'inherit', fontWeight: 600, margin: 0 }}>LIVE KPIS</h2>
      <p style={{ margin: '0 0 8px', color: '#555' }}>Warm-up excluded</p>
      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th />
            <th colSpan={2} style={cell}>
              Throughput
            </th>
            <th style={cell}>WIP</th>
            <th style={cell}>Lead time</th>
          </tr>
          <tr>
            <th />
            <th style={cell}>units/hr</th>
            <th style={cell}>units/shift</th>
            <th style={cell}>units</th>
            <th style={cell}>min</th>
          </tr>
        </thead>
        <tbody>
          {kpis.products.map(line)}
          {line(kpis.total)}
        </tbody>
      </table>
    </section>
  );
}
