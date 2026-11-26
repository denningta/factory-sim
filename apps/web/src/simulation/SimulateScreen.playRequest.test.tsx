import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { useEditorStore } from '../layout/editorStore';
import { useSessionStore } from './sessionStore';
import type { RunSession } from './runSession';
import { SimulateScreen } from './SimulateScreen';

vi.mock('../layout/FloorScene', () => ({
  FloorScene: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
// R3F hooks need a real Canvas.
vi.mock('./TechLayer', () => ({ TechLayer: () => <div /> }));
vi.mock('./StationLayer', () => ({ StationLayer: () => <div /> }));
vi.mock('./RunConnections', () => ({ RunConnections: () => <div /> }));
// Stands in for the render loop that calls session.frame in the real PartLayer.
vi.mock('./PartLayer', () => ({
  PartLayer: ({ session }: { session: RunSession }) => {
    useEffect(() => {
      const id = setInterval(() => session.frame(1 / 60), 5);
      return () => clearInterval(id);
    }, [session]);
    return <div />;
  },
}));

beforeEach(() => {
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
  const t = s().addTechnician();
  s().setTechnicianStation(t.id, ws.id, true);
});
afterEach(cleanup);
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

describe('UI-2 AC2: a play request starts the real run', () => {
  it('starts the session and calls onPlayRequestHandled once', async () => {
    const handled = vi.fn();
    const { rerender } = render(<SimulateScreen />);
    expect(button('Play').disabled).toBe(false);
    rerender(<SimulateScreen playRequest onPlayRequestHandled={handled} />);
    await waitFor(() => expect(button('Pause').disabled).toBe(false));
    expect(handled).toHaveBeenCalledTimes(1);
  });
  it('clears the request even when the run cannot start', async () => {
    useEditorStore.setState({ cycleTimes: [] });
    const handled = vi.fn();
    render(<SimulateScreen playRequest onPlayRequestHandled={handled} />);
    await waitFor(() => expect(handled).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('button', { name: 'Pause' })).toBeNull();
  });
});
