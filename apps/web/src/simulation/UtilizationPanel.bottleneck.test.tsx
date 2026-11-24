import { afterEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import type { RunStats } from '@factory-sim/sim-engine';
import type { RunSession } from './runSession';
import { UtilizationPanel } from './UtilizationPanel';

afterEach(cleanup);

const mk = (a: number, b: number): RunStats => ({
  window: { from: 0, to: 100 },
  byProduct: {},
  total: { released: 0, completed: 0, throughputPerHour: 0, averageWip: 0, averageLeadTime: NaN },
  stations: {
    s1: { working: a, starved: 1 - a, blocked: 0, idle: 0 },
    s2: { working: b, starved: 1 - b, blocked: 0, idle: 0 },
  },
  techs: {},
});

describe('AN-3 AC2/AC3: the bottleneck is flagged in the table and follows the run', () => {
  it('flags the busiest station, and moves the flag when the stats change', () => {
    let stats = mk(0.5, 0.8);
    const listeners = new Set<() => void>();
    const session = {
      stats: () => stats,
      playing: false,
      subscribe: (l: () => void) => (listeners.add(l), () => listeners.delete(l)),
    } as unknown as RunSession;
    render(
      <UtilizationPanel
        session={session}
        stations={[
          { id: 's1', name: 'Weld' },
          { id: 's2', name: 'Cut' },
        ]}
        techs={[]}
      />,
    );
    const table = screen.getByRole('table', { name: 'Station utilization' });
    const flagged = () =>
      within(table)
        .getAllByRole('row')
        .filter((r) => within(r).queryByText('Bottleneck'))
        .map((r) => within(r).getByRole('rowheader').textContent);
    expect(flagged()).toEqual(['Cut']);

    stats = mk(0.9, 0.8);
    act(() => listeners.forEach((l) => l()));
    expect(flagged()).toEqual(['Weld']);
  });

  it('flags nothing before any station has worked', () => {
    const session = {
      stats: () => mk(0, 0),
      playing: false,
      subscribe: () => () => {},
    } as unknown as RunSession;
    render(
      <UtilizationPanel session={session} stations={[{ id: 's1', name: 'Weld' }]} techs={[]} />,
    );
    expect(screen.queryByText('Bottleneck')).toBeNull();
  });
});
