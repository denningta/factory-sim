import { useEffect, useState } from 'react';
import { computeKpis, formatLeadTime, type KpiRow } from './kpis';
import type { RunSession } from './runSession';

const num = (v: number) => v.toFixed(1);
const whole = (v: number) => v.toFixed(0);

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
    // Only while playing: paused and finished runs are covered by the subscribe below.
    const id = setInterval(() => session.playing && setKpis(read()), 200);
    const unsub = session.subscribe(() => setKpis(read()));
    return () => {
      clearInterval(id);
      unsub();
    };
  }, [session, products, shiftLength]);
  const cell = { padding: '2px 3px', textAlign: 'right' as const };
  const line = (r: KpiRow) => (
    <tr key={r.id} aria-label={r.name} style={r.id === 'total' ? { fontWeight: 600 } : undefined}>
      <th
        scope="row"
        style={{ ...cell, textAlign: 'left', overflowWrap: 'anywhere', fontWeight: 'inherit' }}
      >
        {r.name}
      </th>
      <td style={cell}>{num(r.throughputPerHour)}</td>
      <td style={cell}>{whole(r.throughputPerShift)}</td>
      <td style={cell}>{num(r.averageWip)}</td>
      <td style={cell}>{formatLeadTime(r.leadTime)}</td>
    </tr>
  );
  return (
    <section aria-label="Live KPIs" style={{ padding: 12, font: '12px sans-serif' }}>
      <h2 style={{ font: 'inherit', fontWeight: 600, margin: 0 }}>LIVE KPIS</h2>
      <p style={{ margin: '0 0 8px', color: '#555' }}>Warm-up excluded</p>
      <table style={{ borderCollapse: 'collapse', width: '100%', tableLayout: 'fixed' }}>
        <colgroup>
          <col style={{ width: '28%' }} />
          <col style={{ width: '18%' }} />
          <col style={{ width: '20%' }} />
          <col style={{ width: '16%' }} />
          <col style={{ width: '18%' }} />
        </colgroup>
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
            <th style={cell}>
              units/
              <wbr />
              hr
            </th>
            <th style={cell}>
              units/
              <wbr />
              shift
            </th>
            <th style={cell}>units</th>
            <th />
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
