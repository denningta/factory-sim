import { useEffect, useState } from 'react';
import { computeKpis, type KpiRow } from './kpis';
import type { RunSession } from './runSession';
import { BottleneckTile } from './BottleneckTile';
import { KpiTile, LeadTimeIcon, ThroughputIcon, WipIcon } from './KpiTile';
import styles from './KpiPanel.module.css';

const num = (v: number) => v.toFixed(1);
/** Display only: the engine keeps seconds. */
const minutes = (s: number | null) => (s === null ? '–' : (s / 60).toFixed(1));

const perProduct = (rows: KpiRow[], f: (r: KpiRow) => string) =>
  rows.map((r) => `${r.name} ${f(r)}`).join(' · ');

/** Wireframe 3, live KPIs: a strip of four tiles, from the engine's warm-up-free stats. */
export function KpiPanel({
  session,
  products,
  shiftLength,
  stations,
}: {
  session: RunSession;
  products: readonly { id: string; name: string }[];
  shiftLength: number;
  stations: readonly { id: string; name: string }[];
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
  const { total, products: rows } = kpis;
  return (
    <section aria-label="Live KPIs" className={styles.strip}>
      <KpiTile
        label="Throughput"
        icon={<ThroughputIcon />}
        value={num(total.throughputPerHour)}
        unit="units/hr"
        sub={perProduct(rows, (r) => num(r.throughputPerHour))}
      />
      <KpiTile
        label="WIP"
        icon={<WipIcon />}
        value={num(total.averageWip)}
        unit="units"
        sub={perProduct(rows, (r) => num(r.averageWip))}
      />
      <KpiTile
        label="Lead time"
        icon={<LeadTimeIcon />}
        value={minutes(total.leadTime)}
        unit="min"
        sub={perProduct(rows, (r) => minutes(r.leadTime))}
      />
      <BottleneckTile session={session} stations={stations} />
    </section>
  );
}
