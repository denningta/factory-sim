import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEditorStore } from '../layout/editorStore';
import { isStale, useSessionStore } from './sessionStore';
import { SimulateScreen } from './SimulateScreen';
import { loadTestLine } from './testModel';

vi.mock('../layout/FloorScene', () => ({
  FloorScene: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
vi.mock('./TechLayer', () => ({ TechLayer: () => <div /> }));
vi.mock('./StationLayer', () => ({ StationLayer: () => <div /> }));
vi.mock('../layout/ConnectionArcs', () => ({ ConnectionArcs: () => <div /> }));
vi.mock('./PartLayer', () => ({
  PartLayer: () => {
    useEffect(() => undefined, []);
    return <div />;
  },
}));

beforeEach(() => {
  useSessionStore.setState({ count: 0, current: null });
  loadTestLine();
});
afterEach(cleanup);

const st = () => useSessionStore.getState();

describe('UI-6 AC1: runs are counted per session', () => {
  it('startRun, Reset and Apply each start a new run', async () => {
    st().startRun();
    expect(st().current?.number).toBe(1);
    st().startRun();
    expect(st().current?.number).toBe(2);
    st().resetRun();
    expect(st().current?.number).toBe(3);
    st().startRunWith({ warmUp: 0, runLength: 3600 }, 7);
    expect(st().current).toMatchObject({ number: 4, settings: { seed: 7, runLength: 3600 } });
  });

  it('the Reset and Apply buttons on Simulate start new runs', async () => {
    render(<SimulateScreen />);
    expect(st().current?.number).toBe(1);
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(st().current?.number).toBe(2);
    await userEvent.click(screen.getByRole('button', { name: 'Apply' }));
    expect(st().current?.number).toBe(3);
  });
});

describe('UI-6: the run session outlives the Simulate tab', () => {
  it('leaving Simulate keeps the same session; coming back does not start a run', () => {
    const first = render(<SimulateScreen />);
    const session = st().current?.result;
    first.unmount();
    expect(st().current?.result).toBe(session);
    render(<SimulateScreen />);
    expect(st().current?.result).toBe(session);
    expect(st().current?.number).toBe(1);
  });

  it('coming back after the model changed starts a new run', () => {
    render(<SimulateScreen />).unmount();
    useEditorStore.getState().setReleaseInterval(9);
    expect(isStale(st().current!)).toBe(true);
    render(<SimulateScreen />);
    expect(st().current?.number).toBe(2);
    expect(isStale(st().current!)).toBe(false);
  });

  it('Simulate no longer shows the utilization tables (moved to Results)', () => {
    render(<SimulateScreen />);
    expect(screen.queryByRole('table', { name: 'Station utilization' })).toBeNull();
  });
});
