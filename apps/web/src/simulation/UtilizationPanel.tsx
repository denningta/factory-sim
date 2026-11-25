import { useEffect, useState } from 'react';
import type { RunSession } from './runSession';
import { Legend } from '../ui/Legend';
import { useTheme } from '../ui/themeStore';
import type { Theme } from '../ui/tokens';
import { findBottleneck } from './stationStatus';
import {
  sortRows,
  stationUtilization,
  techUtilization,
  type SortState,
  type UtilRow,
} from './utilization';

type Named = { id: string; name: string };

// Bar fills are the state tints (ADR-0016); idle is the waiting gray.
const barColors = (t: Theme): Record<string, string> => ({
  working: t.state.working.tint,
  starved: t.state.starved.tint,
  blocked: t.state.blocked.tint,
  walking: t.state.walking.tint,
  idle: t.state.waiting.tint,
});
const LABELS: Record<string, string> = {
  working: 'Working',
  starved: 'Starved',
  blocked: 'Blocked',
  walking: 'Walking',
  idle: 'Idle',
};

const pct = (v: number) => `${v.toFixed(1)}%`;
const cell = { padding: '2px 3px', textAlign: 'right' as const };

/** Wireframe 4, station and technician utilization: a sortable table with a stacked bar per row. */
export function UtilizationPanel({
  session,
  stations,
  techs,
}: {
  session: RunSession;
  stations: Named[];
  techs: Named[];
}) {
  const read = () => {
    const s = session.stats();
    return {
      st: stationUtilization(s, stations),
      te: techUtilization(s, techs),
      // During warm-up the window is empty and every fraction is 0: show empty bars, not idle.
      started: s.window.to > s.window.from,
    };
  };
  const [data, setData] = useState(read);
  // Same cadence as the KPI panel: text figures, a few times a second and on state changes.
  useEffect(() => {
    setData(read());
    const id = setInterval(() => session.playing && setData(read()), 200);
    const unsub = session.subscribe(() => setData(read()));
    return () => {
      clearInterval(id);
      unsub();
    };
  }, [session, stations, techs]);
  return (
    <section aria-label="Utilization" style={{ padding: 12, font: '12px sans-serif' }}>
      <h2 style={{ font: 'inherit', fontWeight: 600, margin: '0 0 8px' }}>UTILIZATION</h2>
      <UtilTable
        label="Station utilization"
        first="Station"
        rows={data.st}
        started={data.started}
        keys={['working', 'starved', 'blocked', 'idle']}
        bottleneckId={findBottleneck(data.st)}
      />
      <UtilTable
        label="Technician utilization"
        first="Technician"
        rows={data.te}
        started={data.started}
        keys={['working', 'walking', 'idle']}
      />
    </section>
  );
}

function UtilTable<K extends string>({
  label,
  first,
  rows,
  keys,
  started,
  bottleneckId,
}: {
  label: string;
  first: string;
  rows: UtilRow<K>[];
  keys: K[];
  started: boolean;
  /** AN-3: the station with the highest working %, flagged in its row. */
  bottleneckId?: string | null;
}) {
  const theme = useTheme();
  const COLORS = barColors(theme);
  const [sort, setSort] = useState<SortState<K> | null>(null);
  const shown = sort ? sortRows(rows, sort) : rows;
  // First click: biggest share first (names: A–Z); a second click reverses.
  const toggle = (key: 'name' | K) =>
    setSort((s) =>
      s?.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'name' ? 'asc' : 'desc' },
    );
  const head = (key: 'name' | K, text: string, align: 'left' | 'right') => (
    <th
      key={key}
      scope="col"
      aria-sort={sort?.key === key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}
      style={{ ...cell, textAlign: align }}
    >
      <button
        type="button"
        onClick={() => toggle(key)}
        style={{ all: 'unset', cursor: 'pointer', font: 'inherit', fontWeight: 600 }}
      >
        {text}
        {sort?.key === key ? (sort.dir === 'asc' ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  );
  return (
    <>
      <Legend
        label={`${label} legend`}
        items={keys.map((k) => ({ key: k, label: LABELS[k]!, color: COLORS[k]! }))}
      />
      <table
        aria-label={label}
        style={{
          borderCollapse: 'collapse',
          width: '100%',
          marginBottom: 12,
          tableLayout: 'fixed',
        }}
      >
        <thead>
          <tr>
            {head('name', first, 'left')}
            {keys.map((k) => head(k, LABELS[k]!, 'right'))}
          </tr>
        </thead>
        <tbody>
          {shown.map((r) => (
            <Row
              key={r.id}
              row={r}
              keys={keys}
              started={started}
              bottleneck={r.id === bottleneckId}
            />
          ))}
        </tbody>
      </table>
    </>
  );
}

function Row<K extends string>({
  row,
  keys,
  started,
  bottleneck,
}: {
  row: UtilRow<K>;
  keys: K[];
  started: boolean;
  bottleneck: boolean;
}) {
  const theme = useTheme();
  const COLORS = barColors(theme);
  const summary = keys.map((k) => `${k} ${pct(row[k])}`).join(', ');
  return (
    <>
      <tr aria-label={row.name}>
        <th scope="row" style={{ ...cell, textAlign: 'left', fontWeight: 'inherit' }}>
          {row.name}
        </th>
        {keys.map((k) => (
          <td key={k} style={cell}>
            {pct(row[k])}
          </td>
        ))}
      </tr>
      <tr role="none">
        <td colSpan={keys.length + 1} style={{ padding: '0 3px 6px' }}>
          {bottleneck && (
            // In the bar row so the name cell stays just the name (sorting, labels).
            <span style={{ color: theme.color.danger, fontWeight: 600, fontSize: 11 }}>
              ▲ Bottleneck
            </span>
          )}
          <div
            role="img"
            aria-label={`${row.name}: ${summary}`}
            style={{
              display: 'flex',
              height: 10,
              background: started ? COLORS.idle : theme.color.bg,
            }}
          >
            {keys.map((k) => (
              <span
                key={k}
                title={`${LABELS[k]} ${pct(row[k])}`}
                style={{ width: `${row[k]}%`, background: COLORS[k] }}
              />
            ))}
          </div>
        </td>
      </tr>
    </>
  );
}
