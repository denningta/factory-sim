import { useEffect, useState } from 'react';
import type { RunSession } from './runSession';
import {
  sortRows,
  stationUtilization,
  techUtilization,
  type SortState,
  type UtilRow,
} from './utilization';

type Named = { id: string; name: string };

// Wireframe 4 colors: working green, starved yellow, blocked red, idle gray, walking purple.
const COLORS: Record<string, string> = {
  working: '#86d9a0',
  starved: '#f6d860',
  blocked: '#ee8c8c',
  walking: '#c9a6ec',
  idle: '#cfd4dc',
};
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
    return { st: stationUtilization(s, stations), te: techUtilization(s, techs) };
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
        keys={['working', 'starved', 'blocked', 'idle']}
      />
      <UtilTable
        label="Technician utilization"
        first="Technician"
        rows={data.te}
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
}: {
  label: string;
  first: string;
  rows: UtilRow<K>[];
  keys: K[];
}) {
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
    <table
      aria-label={label}
      style={{ borderCollapse: 'collapse', width: '100%', marginBottom: 12 }}
    >
      <thead>
        <tr>
          {head('name', first, 'left')}
          {keys.map((k) => head(k, LABELS[k]!, 'right'))}
        </tr>
      </thead>
      <tbody>
        {shown.map((r) => (
          <Row key={r.id} row={r} keys={keys} />
        ))}
      </tbody>
    </table>
  );
}

function Row<K extends string>({ row, keys }: { row: UtilRow<K>; keys: K[] }) {
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
          <div
            role="img"
            aria-label={`${row.name}: ${summary}`}
            style={{ display: 'flex', height: 10, background: COLORS.idle }}
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
