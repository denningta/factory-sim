import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { RunStats } from '@factory-sim/sim-engine';
import type { RunSession } from './runSession';
import { UtilizationPanel } from './UtilizationPanel';

afterEach(cleanup);

const stats: RunStats = {
  window: { from: 0, to: 100 },
  byProduct: {},
  total: { released: 0, completed: 0, throughputPerHour: 0, averageWip: 0, averageLeadTime: NaN },
  stations: {
    s1: { working: 0.5, starved: 0.25, blocked: 0.125, idle: 0.125 },
    s2: { working: 0.8, starved: 0, blocked: 0, idle: 0.2 },
  },
  techs: { t1: { working: 0.6, walking: 0.1, idle: 0.3 } },
};
const session = {
  stats: () => stats,
  playing: false,
  subscribe: () => () => {},
} as unknown as RunSession;

const renderPanel = () =>
  render(
    <UtilizationPanel
      session={session}
      stations={[
        { id: 's1', name: 'Weld' },
        { id: 's2', name: 'Cut' },
      ]}
      techs={[{ id: 't1', name: 'Tech 1' }]}
    />,
  );
const names = (table: HTMLElement) =>
  within(table)
    .getAllByRole('row')
    .map((r) => within(r).queryByRole('rowheader')?.textContent)
    .filter(Boolean);

describe('AN-2 AC1: station table', () => {
  it('shows working, starved, blocked and idle % for each station', () => {
    renderPanel();
    const table = screen.getByRole('table', { name: 'Station utilization' });
    const weld = within(table).getByRole('row', { name: /Weld/ });
    expect(
      within(weld)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['50.0%', '25.0%', '12.5%', '12.5%']);
    expect(within(table).getByRole('columnheader', { name: /Blocked/ })).toBeTruthy();
  });
});

describe('AN-2 AC2: tech table', () => {
  it('shows working, walking and idle % for each tech', () => {
    renderPanel();
    const table = screen.getByRole('table', { name: 'Technician utilization' });
    const row = within(table).getByRole('row', { name: /Tech 1/ });
    expect(
      within(row)
        .getAllByRole('cell')
        .map((c) => c.textContent),
    ).toEqual(['60.0%', '10.0%', '30.0%']);
    expect(within(table).queryByRole('columnheader', { name: /Blocked/ })).toBeNull();
  });
});

describe('AN-2 AC3: sortable table and stacked bars', () => {
  it('sorts when a column header is clicked, toggling direction', async () => {
    renderPanel();
    const table = screen.getByRole('table', { name: 'Station utilization' });
    expect(names(table)).toEqual(['Weld', 'Cut']);
    await userEvent.click(within(table).getByRole('button', { name: /Working/ }));
    expect(names(table)).toEqual(['Cut', 'Weld']); // highest first
    expect(within(table).getByRole('columnheader', { name: /Working/ }).getAttribute('aria-sort')).toBe('descending');
    await userEvent.click(within(table).getByRole('button', { name: /Working/ }));
    expect(names(table)).toEqual(['Weld', 'Cut']);
  });

  it('draws a stacked bar per row with a segment per state, sized by its share', () => {
    renderPanel();
    const bar = screen.getByRole('img', { name: /Weld.*working 50\.0%/i });
    const segs = Array.from(bar.children) as HTMLElement[];
    expect(segs).toHaveLength(4);
    expect(segs.map((s) => s.style.width)).toEqual(['50%', '25%', '12.5%', '12.5%']);
    expect(screen.getByRole('img', { name: /Tech 1/ }).children).toHaveLength(3);
  });
});
