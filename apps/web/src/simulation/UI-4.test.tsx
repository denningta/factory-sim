import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEditorStore } from '../layout/editorStore';
import { useSessionStore } from './sessionStore';
import { SimulateScreen } from './SimulateScreen';

vi.mock('../layout/FloorScene', () => ({
  FloorScene: ({ children }: { children?: ReactNode }) => <div data-testid="scene">{children}</div>,
}));
vi.mock('./TechLayer', () => ({ TechLayer: () => <div /> }));
vi.mock('./StationLayer', () => ({ StationLayer: () => <div /> }));
vi.mock('./RunConnections', () => ({ RunConnections: () => <div /> }));
vi.mock('./PartLayer', () => ({ PartLayer: () => <div /> }));

const build = (withTech: boolean) => {
  useSessionStore.setState({ count: 0, current: null });
  useEditorStore.setState(useEditorStore.getInitialState(), true);
  const s = useEditorStore.getState;
  const src = s().placeEquipment('base-source', { x: 0, y: 0 })!;
  const ws = s().placeEquipment('base-workstation', { x: 6, y: 0 })!;
  const sink = s().placeEquipment('base-sink', { x: 12, y: 0 })!;
  s().connect({ equipmentId: src.id, portId: 'out' }, { equipmentId: ws.id, portId: 'in' });
  s().connect({ equipmentId: ws.id, portId: 'out' }, { equipmentId: sink.id, portId: 'in' });
  const p = s().addProduct();
  s().addRoutingStep(p.id, ws.id);
  s().setCycleTime(p.id, ws.id, 5);
  s().setReleaseInterval(4);
  if (withTech) {
    const t = s().addTechnician();
    s().setTechnicianStation(t.id, ws.id, true);
  }
};
afterEach(cleanup);

describe('UI-4 AC1: playback controls float over the top-left of the viewport', () => {
  beforeEach(() => build(true));
  it('puts the toolbar inside the viewport element, with every control and the clock', () => {
    render(<SimulateScreen />);
    const bar = screen.getByRole('toolbar', { name: 'Playback' });
    expect(screen.getByTestId('scene').parentElement!.contains(bar)).toBe(true);
    for (const name of ['Play', 'Pause', 'Step', 'Reset', 'Run to end'])
      expect(within(bar).getByRole('button', { name })).toBeTruthy();
    expect(within(bar).getByLabelText('Speed')).toBeTruthy();
    expect(within(bar).getByLabelText('Animate')).toBeTruthy();
    expect(within(bar).getByRole('timer').textContent).toMatch(/^Day 1, 00:00:00/);
    expect(within(bar).getByText('1×')).toBeTruthy();
  });
});

describe('UI-4 AC2: four live KPI tiles across the top of the viewport', () => {
  beforeEach(() => build(true));
  it('shows Throughput, WIP, Lead time and Bottleneck tiles inside the viewport', () => {
    render(<SimulateScreen />);
    const strip = screen.getByRole('region', { name: 'Live KPIs' });
    expect(screen.getByTestId('scene').parentElement!.contains(strip)).toBe(true);
    const tiles = within(strip).getAllByRole('group');
    expect(tiles.map((t) => t.getAttribute('aria-label'))).toEqual([
      'Throughput',
      'WIP',
      'Lead time',
      'Bottleneck',
    ]);
  });
  it('names the units, gives a per-product sub-line and a warm-up note on each tile', () => {
    render(<SimulateScreen />);
    const name = useEditorStore.getState().products[0]!.name;
    const tile = (n: string) => screen.getByRole('group', { name: n });
    expect(tile('Throughput').textContent).toContain('units/hr');
    expect(tile('Throughput').textContent).toContain(`${name} 0`);
    expect(tile('WIP').textContent).toContain('units');
    expect(tile('WIP').textContent).toContain(`${name} 0`);
    expect(tile('Lead time').textContent).toContain('min');
    expect(tile('Lead time').textContent).toContain(`${name} –`);
    for (const n of ['Throughput', 'WIP', 'Lead time', 'Bottleneck'])
      expect(tile(n).textContent).toContain('Warm-up excluded');
  });
  it('shows the bottleneck station and its working % once the run has finished', async () => {
    render(<SimulateScreen />);
    await userEvent.click(screen.getByRole('button', { name: 'Run to end' }));
    await waitFor(() =>
      expect(screen.getByRole('group', { name: 'Bottleneck' }).textContent).toMatch(/\d+% working/),
    );
    expect(screen.getByRole('group', { name: 'Bottleneck' }).textContent).toMatch(/Workstation/);
  });
});

describe('UI-4 AC3: the model check shows as a banner', () => {
  it('success tone: "Model check passed · 0 errors"', () => {
    build(true);
    render(<SimulateScreen />);
    expect(screen.getByRole('status', { name: 'Model check' }).textContent).toContain(
      'Model check passed · 0 errors',
    );
  });
  it('danger tone: an alert banner listing the issues, each a button', () => {
    build(false);
    render(<SimulateScreen />);
    const banner = screen.getByRole('alert', { name: 'Model check' });
    expect(within(banner).getByRole('button', { name: /no technician/i })).toBeTruthy();
    expect(screen.queryByRole('status', { name: 'Model check' })).toBeNull();
  });
});

describe('UI-4 AC4: run settings are a collapsible section below the tiles', () => {
  beforeEach(() => build(true));
  const toggle = () => screen.getByRole('button', { name: /Run settings/ });
  it('starts open, can be toggled, and collapses after Apply', async () => {
    render(<SimulateScreen />);
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    await userEvent.click(toggle());
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    await userEvent.click(toggle());
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
  });
  it('does not collapse when Apply is rejected', async () => {
    render(<SimulateScreen />);
    await userEvent.clear(screen.getByLabelText('Warm-up (hr)'));
    await userEvent.type(screen.getByLabelText('Warm-up (hr)'), '999');
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
  });
});

describe('UI-4 AC5: utilization tables are gone; a link opens Results', () => {
  beforeEach(() => build(true));
  it('has no utilization tables or KPI table', () => {
    render(<SimulateScreen />);
    expect(screen.queryByRole('table')).toBeNull();
    expect(screen.queryByText(/utilization/i)).toBeNull();
  });
  it('"See full results →" calls onOpenResults', async () => {
    const onOpenResults = vi.fn();
    render(<SimulateScreen onOpenResults={onOpenResults} />);
    await userEvent.click(screen.getByRole('button', { name: 'See full results →' }));
    expect(onOpenResults).toHaveBeenCalledOnce();
  });
});
