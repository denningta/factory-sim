import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import type { RunStats } from '@factory-sim/sim-engine';
import { UtilizationBars } from './UtilizationBars';

afterEach(cleanup);

const stats: RunStats = {
  window: { from: 0, to: 100 },
  byProduct: {},
  total: { released: 0, completed: 0, throughputPerHour: 0, averageWip: 0, averageLeadTime: NaN },
  stations: {
    s1: { working: 0.4, starved: 0.4, blocked: 0.1, idle: 0.1 },
    s2: { working: 0.9, starved: 0, blocked: 0, idle: 0.1 },
    s3: { working: 0.6, starved: 0, blocked: 0.3, idle: 0.1 },
  },
  techs: {
    t1: { working: 0.3, walking: 0.2, idle: 0.5 },
    t2: { working: 0.7, walking: 0.1, idle: 0.2 },
  },
};
const stations = [
  { id: 's1', name: 'Saw' },
  { id: 's2', name: 'Weld' },
  { id: 's3', name: 'Cut' },
];
const techs = [
  { id: 't1', name: 'Tech 1' },
  { id: 't2', name: 'Tech 2' },
];

describe('UI-6 AC5: utilization bars', () => {
  it('sorts stations and technicians by working %, highest first', () => {
    render(<UtilizationBars stats={stats} stations={stations} techs={techs} />);
    const names = (label: string) =>
      within(screen.getByRole('list', { name: label }))
        .getAllByRole('img')
        .map((el) => el.getAttribute('aria-label')!.split(':')[0]);
    expect(names('Station utilization')).toEqual(['Weld', 'Cut', 'Saw']);
    expect(names('Technician utilization')).toEqual(['Tech 2', 'Tech 1']);
  });

  it('has a legend per group, with "Waiting for tech" for stations, not "Idle"', () => {
    render(<UtilizationBars stats={stats} stations={stations} techs={techs} />);
    const st = within(screen.getByRole('list', { name: 'Station utilization legend' }));
    expect(st.getByText('Waiting for tech')).toBeTruthy();
    expect(st.queryByText('Idle')).toBeNull();
    const te = within(screen.getByRole('list', { name: 'Technician utilization legend' }));
    expect(te.getByText('Walking')).toBeTruthy();
  });

  it('shows each bar’s percentages in its label', () => {
    render(<UtilizationBars stats={stats} stations={stations} techs={techs} />);
    expect(screen.getByRole('img', { name: /Weld: .*working 90\.0%/ })).toBeTruthy();
  });
});
