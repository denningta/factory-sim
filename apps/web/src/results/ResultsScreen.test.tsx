import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEditorStore } from '../layout/editorStore';
import { useSessionStore } from '../simulation/sessionStore';
import { loadTestLine } from '../simulation/testModel';
import { ResultsScreen } from './ResultsScreen';

afterEach(cleanup);

let stationId = '';
const handlers = () => ({
  onOpenSimulate: vi.fn(),
  onRunAgain: vi.fn(),
  onOpenInLayout: vi.fn(),
});

/** One shift of the test line, finished. */
function finishRun() {
  useSessionStore.getState().startRunWith({ warmUp: 0, runLength: 3600 }, 5);
  const r = useSessionStore.getState().current!.result;
  if (!r.ok) throw new Error('should run');
  act(() => {
    r.session.runToEnd();
    for (let i = 0; i < 1000 && !r.session.done; i++) r.session.frame(1000);
  });
  return r.session;
}

beforeEach(() => {
  useSessionStore.setState({ count: 0, current: null });
  stationId = loadTestLine().stationId;
});

describe('UI-6 AC7: before any run', () => {
  it('shows an empty state whose button opens Simulate', async () => {
    const h = handlers();
    render(<ResultsScreen {...h} />);
    expect(screen.getByText('Run a simulation to see results')).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /simulate/i }));
    expect(h.onOpenSimulate).toHaveBeenCalledOnce();
  });
});

describe('UI-6 AC1: header', () => {
  it('shows run number, length, warm-up and seed, and a complete run', () => {
    finishRun();
    render(<ResultsScreen {...handlers()} />);
    const head = screen.getByRole('banner');
    expect(head.textContent).toContain('Results · run 1');
    expect(head.textContent).toMatch(/Run length 1 h/);
    expect(head.textContent).toMatch(/Warm-up 0 h/);
    expect(head.textContent).toMatch(/Seed 5/);
    expect(within(head).getByText('Complete')).toBeTruthy();
  });

  it('says in progress while the run is going, and the figures update live', () => {
    useSessionStore.getState().startRunWith({ warmUp: 0, runLength: 3600 }, 5);
    render(<ResultsScreen {...handlers()} />);
    expect(within(screen.getByRole('banner')).getByText('In progress')).toBeTruthy();
    const r = useSessionStore.getState().current!.result;
    if (!r.ok) throw new Error('should run');
    act(() => r.session.runToEnd());
    act(() => {
      for (let i = 0; i < 1000 && !r.session.done; i++) r.session.frame(1000);
    });
    expect(within(screen.getByRole('banner')).getByText('Complete')).toBeTruthy();
  });
});

describe('UI-6 AC2: stat tiles', () => {
  it('shows throughput vs demand, WIP, lead time and the Little’s Law check', () => {
    finishRun();
    render(<ResultsScreen {...handlers()} />);
    const tile = (name: string) => within(screen.getByRole('group', { name }));
    expect(tile('Throughput per shift').getByText(/demand/i)).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Average WIP' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Average lead time' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Little’s Law check' }).textContent).toMatch(
      /Pass|Fail/,
    );
  });
});

describe('UI-6 AC3: by product', () => {
  it('has a row per product with units/hr, units/shift, WIP and lead time', () => {
    finishRun();
    render(<ResultsScreen {...handlers()} />);
    const table = screen.getByRole('table', { name: 'By product' });
    const name = useEditorStore.getState().products[0]!.name;
    const row = within(table).getByRole('row', { name: new RegExp(name) });
    expect(within(row).getAllByRole('cell').length).toBeGreaterThanOrEqual(4);
    expect(within(table).getByRole('columnheader', { name: /units\/hr/ })).toBeTruthy();
    expect(within(table).getByRole('columnheader', { name: /units\/shift/ })).toBeTruthy();
    expect(within(row).getByTestId('product-dot')).toBeTruthy();
  });
});

describe('UI-6 AC4: bottleneck box', () => {
  it('names the station with its working % and Open in Layout selects it', async () => {
    finishRun();
    const h = handlers();
    render(<ResultsScreen {...h} />);
    const box = within(screen.getByRole('region', { name: 'Bottleneck' }));
    const name = useEditorStore.getState().equipment.find((e) => e.id === stationId)!.name;
    expect(box.getByText(new RegExp(`${name}.*% working`))).toBeTruthy();
    await userEvent.click(box.getByRole('button', { name: /Open in Layout/ }));
    expect(h.onOpenInLayout).toHaveBeenCalledWith(stationId);
  });
});

describe('UI-6 AC5: utilization is on Results', () => {
  it('renders station and technician utilization bars', () => {
    finishRun();
    render(<ResultsScreen {...handlers()} />);
    expect(screen.getByRole('list', { name: 'Station utilization' })).toBeTruthy();
    expect(screen.getByRole('list', { name: 'Technician utilization' })).toBeTruthy();
  });
});

describe('UI-6 AC6: the model changed after the run', () => {
  it('shows a notice with a run-again button and keeps the figures', async () => {
    finishRun();
    const h = handlers();
    render(<ResultsScreen {...h} />);
    expect(screen.queryByText('The model changed since this run')).toBeNull();
    act(() => useEditorStore.getState().setReleaseInterval(9));
    expect(screen.getByText('The model changed since this run')).toBeTruthy();
    expect(screen.getByRole('table', { name: 'By product' })).toBeTruthy();
    await userEvent.click(screen.getByRole('button', { name: /run again/i }));
    expect(h.onRunAgain).toHaveBeenCalledOnce();
  });
});
