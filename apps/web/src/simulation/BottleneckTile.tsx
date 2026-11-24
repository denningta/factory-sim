import { useEffect, useState } from 'react';
import type { RunSession } from './runSession';
import { bottleneckSummary } from './stationStatus';
import { stationUtilization } from './utilization';

/** Wireframe 3 (AN-1/AN-3): the constraint at a glance, next to the live KPIs. */
export function BottleneckTile({
  session,
  stations,
}: {
  session: RunSession;
  stations: { id: string; name: string }[];
}) {
  const read = () => bottleneckSummary(stationUtilization(session.stats(), stations));
  const [b, setB] = useState(read);
  useEffect(() => {
    setB(read());
    const id = setInterval(() => session.playing && setB(read()), 200);
    const unsub = session.subscribe(() => setB(read()));
    return () => {
      clearInterval(id);
      unsub();
    };
  }, [session, stations]);
  return (
    <section aria-label="Bottleneck" style={{ padding: '0 12px', font: '12px sans-serif' }}>
      <div style={{ border: '1px solid #cbd5e1', borderRadius: 4, padding: '6px 8px' }}>
        <strong>Bottleneck: </strong>
        {b ? `${b.name}, ${b.working.toFixed(0)}% working` : '–'}
      </div>
    </section>
  );
}
