import { useEffect, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEditorStore } from '../layout/editorStore';
import type { RunSession } from './runSession';
import { SimulateScreen } from './SimulateScreen';

vi.mock('../layout/FloorScene', () => ({
  FloorScene: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
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

const clock = () => screen.getByRole('timer').textContent ?? '';
const button = (name: string) => screen.getByRole('button', { name }) as HTMLButtonElement;

describe('SE-2: SimulateScreen playback controls', () => {
  it('Step moves the clock past 0:00:00 and the button still reads Play', async () => {
    render(<SimulateScreen />);
    expect(clock()).toMatch(/^0:00:00/);
    // Early events can share the same second, so take a few steps.
    for (let i = 0; i < 6; i++) await userEvent.click(button('Step'));
    await waitFor(() => expect(clock()).not.toMatch(/^0:00:00/));
    expect(button('Play')).toBeTruthy();
  });

  it('Run to end unchecks Animate, finishes, and disables Step and Run to end', async () => {
    render(<SimulateScreen />);
    await userEvent.click(button('Run to end'));
    await waitFor(() => expect(clock()).toContain('(finished)'), { timeout: 5000 });
    expect((screen.getByLabelText('Animate') as HTMLInputElement).checked).toBe(false);
    expect(button('Step').disabled).toBe(true);
    expect(button('Run to end').disabled).toBe(true);
  });

  it('Reset puts the clock back to 0:00:00', async () => {
    render(<SimulateScreen />);
    await userEvent.click(button('Run to end'));
    await waitFor(() => expect(clock()).toContain('(finished)'), { timeout: 5000 });
    await userEvent.click(button('Reset'));
    await waitFor(() => expect(clock()).toBe('0:00:00'));
    expect(button('Step').disabled).toBe(false);
  });
});
