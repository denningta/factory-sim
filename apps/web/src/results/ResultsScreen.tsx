import { useEffect, useState } from 'react';
import type { RunStats } from '@factory-sim/sim-engine';
import { useEditorStore } from '../layout/editorStore';
import { computeKpis, formatLeadTime, littlesLaw } from '../simulation/kpis';
import type { RunSession } from '../simulation/runSession';
import { isStale, useSessionStore } from '../simulation/sessionStore';
import { findBottleneck } from '../simulation/stationStatus';
import { stationUtilization } from '../simulation/utilization';
import { Badge, Button, EmptyState, Section, StatTile } from '../ui';
import { bottleneckContext } from './bottleneckContext';
import { UtilizationBars } from './UtilizationBars';
import styles from './ResultsScreen.module.css';

const hours = (seconds: number) => `${Number((seconds / 3600).toFixed(2))} h`;

/** Figures as text: re-read a few times a second while playing, and on every session change. */
function useStats(session: RunSession | null): RunStats | null {
  const [stats, setStats] = useState<RunStats | null>(() => session?.stats() ?? null);
  useEffect(() => {
    if (!session) return setStats(null);
    const read = () => setStats(session.stats());
    read();
    const id = setInterval(() => session.playing && read(), 200);
    const unsub = session.subscribe(read);
    return () => {
      clearInterval(id);
      unsub();
    };
  }, [session]);
  return stats;
}

/** Units per shift the model asks for: stated per shift, or implied by a fixed release interval. */
function demandPerShift(
  demand: { basis: string; items: { value: number }[] },
  release: { interval: { kind: string; value?: number } },
  shiftLength: number,
): number | null {
  if (demand.basis === 'perShift') return demand.items.reduce((t, i) => t + i.value, 0);
  const i = release.interval;
  return i.kind === 'fixed' && i.value ? shiftLength / i.value : null;
}

const join = (ids: string[], nameOf: (id: string) => string) => ids.map(nameOf).join(', ');

/** Wireframe 4: the run summary and the bottleneck explanation. */
export function ResultsScreen({
  onOpenSimulate,
  onRunAgain,
  onOpenInLayout,
}: {
  onOpenSimulate: () => void;
  onRunAgain: () => void;
  onOpenInLayout: (stationId: string) => void;
}) {
  const current = useSessionStore((s) => s.current);
  const session = current?.result.ok ? current.result.session : null;
  const stats = useStats(session);
  // Re-evaluated on every editor change; true once the model differs from the one the run used.
  const stale = useEditorStore(() => (current ? isStale(current) : false));
  const equipment = useEditorStore((s) => s.equipment);
  const products = useEditorStore((s) => s.products);
  const technicians = useEditorStore((s) => s.technicians);
  const connections = useEditorStore((s) => s.connections);
  const demand = useEditorStore((s) => s.demand);
  const release = useEditorStore((s) => s.release);
  const shiftLength = useEditorStore((s) => s.shiftLength);

  if (!current || !session || !stats)
    return (
      <div className={styles.screen}>
        <EmptyState
          title="Run a simulation to see results"
          action={<Button onClick={onOpenSimulate}>Open Simulate</Button>}
        />
      </div>
    );

  const stations = equipment.filter((e) => e.behavior === 'workstation');
  const nameOf = (id: string) => stations.find((s) => s.id === id)?.name ?? id;
  const kpis = computeKpis(stats, products, shiftLength);
  const little = littlesLaw(kpis.total);
  const wanted = demandPerShift(demand, release, shiftLength);
  const rows = stationUtilization(stats, stations);
  const bottleneckId = findBottleneck(rows);
  const bottleneck = rows.find((r) => r.id === bottleneckId);
  const context = bottleneckId
    ? bottleneckContext(
        connections,
        rows.map((r) => ({ id: r.id, blocked: r.blocked / 100, starved: r.starved / 100 })),
        bottleneckId,
      )
    : null;
  const sentence = context
    ? [
        context.blockedUpstream.length > 0 &&
          `Upstream, ${join(context.blockedUpstream, nameOf)} ${context.blockedUpstream.length > 1 ? 'are' : 'is'} mostly blocked.`,
        context.starvedDownstream.length > 0 &&
          `Downstream, ${join(context.starvedDownstream, nameOf)} ${context.starvedDownstream.length > 1 ? 'are' : 'is'} mostly starved.`,
      ]
        .filter(Boolean)
        .join(' ') || 'No station upstream is mostly blocked and none downstream is mostly starved.'
    : '';

  return (
    <div className={styles.screen}>
      <section aria-label="Run summary" className={styles.header}>
        <h1 className={styles.title}>Results · run {current.number}</h1>
        <span className={styles.meta}>Run length {hours(current.settings.runLength)}</span>
        <span className={styles.meta}>Warm-up {hours(current.settings.warmUp)}</span>
        <span className={styles.meta}>Seed {current.settings.seed}</span>
        <Badge tone={session.done ? 'accent' : 'neutral'}>
          {session.done ? 'Complete' : 'In progress'}
        </Badge>
      </section>

      {stale && (
        <div role="status" className={styles.stale}>
          <span>The model changed since this run</span>
          <Button onClick={onRunAgain}>Run again</Button>
        </div>
      )}

      <div className={styles.tiles}>
        <StatTile
          label="Throughput per shift"
          value={kpis.total.throughputPerShift.toFixed(0)}
          unit="units"
          sub={wanted === null ? 'demand not set' : `demand ${wanted.toFixed(0)} /shift`}
        />
        <StatTile label="Average WIP" value={kpis.total.averageWip.toFixed(1)} unit="units" />
        <StatTile label="Average lead time" value={formatLeadTime(kpis.total.leadTime)} />
        <StatTile
          label="Little’s Law check"
          value={little.ok === null ? '–' : little.ok ? 'Pass' : 'Fail'}
          sub={
            little.ok === null
              ? 'needs a finished part'
              : `WIP ${kpis.total.averageWip.toFixed(1)} vs throughput × lead time ${little.expectedWip.toFixed(1)}`
          }
        />
      </div>

      <div className={styles.columns}>
        <Section heading="By product">
          <table aria-label="By product" className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Product</th>
                <th scope="col">units/hr</th>
                <th scope="col">units/shift</th>
                <th scope="col">Avg WIP</th>
                <th scope="col">Avg lead time</th>
              </tr>
            </thead>
            <tbody>
              {kpis.products.map((r) => (
                <tr key={r.id} aria-label={r.name}>
                  <th scope="row">
                    <span
                      data-testid="product-dot"
                      className={styles.dot}
                      // eslint-disable-next-line no-restricted-syntax -- the product's own colour is data
                      style={{ background: products.find((p) => p.id === r.id)?.color }}
                    />
                    {r.name}
                  </th>
                  <td>{r.throughputPerHour.toFixed(1)}</td>
                  <td>{r.throughputPerShift.toFixed(0)}</td>
                  <td>{r.averageWip.toFixed(1)}</td>
                  <td>{formatLeadTime(r.leadTime)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>

        <section aria-label="Bottleneck" className={styles.bottleneck}>
          <h2 className={styles.heading}>Bottleneck</h2>
          {bottleneck ? (
            <>
              <strong className={styles.bottleneckName}>
                {bottleneck.name}, {bottleneck.working.toFixed(0)}% working
              </strong>
              <p className={styles.sentence}>{sentence}</p>
              <Button onClick={() => onOpenInLayout(bottleneck.id)}>Open in Layout →</Button>
            </>
          ) : (
            <p className={styles.sentence}>No station has worked yet.</p>
          )}
        </section>
      </div>

      <Section heading="Utilization">
        <UtilizationBars
          stats={stats}
          stations={stations}
          techs={technicians}
          bottleneckId={bottleneckId}
        />
      </Section>
    </div>
  );
}
