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

describe('SE-4: run settings panel', () => {
  const field = (name: string) => screen.getByLabelText(name) as HTMLInputElement;
  const set = async (name: string, value: string) => {
    await userEvent.clear(field(name));
    await userEvent.type(field(name), value);
  };

  it('run length in shifts and warm-up use the shift length: the run ends at warm-up + length', async () => {
    render(<SimulateScreen />);
    await set('Shift length (hr)', '1');
    await set('Warm-up (hr)', '1');
    await set('Run length', '2');
    await userEvent.click(button('Apply'));
    await userEvent.click(button('Run to end'));
    await waitFor(() => expect(clock()).toBe('3:00:00 (finished)'), { timeout: 5000 });
    expect(useEditorStore.getState().shiftLength).toBe(3600);
  });

  it('run length can be given in hours', async () => {
    render(<SimulateScreen />);
    await userEvent.selectOptions(screen.getByLabelText('Run length unit'), 'hours');
    await set('Run length', '2');
    await userEvent.click(button('Apply'));
    await userEvent.click(button('Run to end'));
    await waitFor(() => expect(clock()).toBe('2:00:00 (finished)'), { timeout: 5000 });
  });

  it('a random seed is drawn on Apply and shown; a fixed seed is kept', async () => {
    render(<SimulateScreen />);
    expect(field('Seed').value).toBe('1');
    await userEvent.selectOptions(screen.getByLabelText('Seed mode'), 'random');
    await userEvent.click(button('Apply'));
    const drawn = screen.getByRole('status', { name: 'Seed used' }).textContent ?? '';
    expect(drawn).toMatch(/\d+/);
    await userEvent.selectOptions(screen.getByLabelText('Seed mode'), 'fixed');
    await set('Seed', '42');
    await userEvent.click(button('Apply'));
    expect(screen.getByRole('status', { name: 'Seed used' }).textContent).toContain('42');
  });
});
