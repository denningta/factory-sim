import { useEffect, useState } from 'react';
import type { RunSession } from './runSession';
import { bottleneckSummary } from './stationStatus';
import { stationUtilization } from './utilization';
import { BottleneckIcon, KpiTile } from './KpiTile';

/** Wireframe 3 (AN-1/AN-3): the constraint at a glance, the fourth live KPI tile. */
export function BottleneckTile({
  session,
  stations,
}: {
  session: RunSession;
  stations: readonly { id: string; name: string }[];
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
    <KpiTile
      label="Bottleneck"
      icon={<BottleneckIcon />}
      value={b ? b.name : '–'}
      sub={b ? `${b.working.toFixed(0)}% working` : undefined}
    />
  );
}
