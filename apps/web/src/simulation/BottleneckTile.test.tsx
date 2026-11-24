import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { RunStats } from '@factory-sim/sim-engine';
import type { RunSession } from './runSession';
import { BottleneckTile } from './BottleneckTile';

afterEach(cleanup);

const stats = (a: number, b: number): RunStats => ({
  window: { from: 0, to: 100 },
  byProduct: {},
  total: { released: 0, completed: 0, throughputPerHour: 0, averageWip: 0, averageLeadTime: NaN },
  stations: {
    s1: { working: a, starved: 1 - a, blocked: 0, idle: 0 },
    s2: { working: b, starved: 1 - b, blocked: 0, idle: 0 },
  },
  techs: {},
});
const tile = (s: RunStats) =>
  render(
    <BottleneckTile
      session={
        { stats: () => s, playing: false, subscribe: () => () => {} } as unknown as RunSession
      }
      stations={[
        { id: 's1', name: 'Weld' },
        { id: 's2', name: 'Cut' },
      ]}
    />,
  );

describe('AN-1/AN-3: Bottleneck KPI tile (wireframe 3)', () => {
  it('shows the bottleneck station and its working %', () => {
    tile(stats(0.5, 0.82));
    expect(screen.getByRole('region', { name: 'Bottleneck' }).textContent).toBe(
      'Bottleneck: Cut, 82% working',
    );
  });
  it('shows a dash before any station has worked', () => {
    tile(stats(0, 0));
    expect(screen.getByRole('region', { name: 'Bottleneck' }).textContent).toBe('Bottleneck: –');
  });
});
