import type { Labor } from '@factory-sim/schema';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PropertiesPanel } from '../layout/PropertiesPanel';
import { createEditorStore } from '../layout/editorStore';
import { TechniciansPanel } from './TechniciansPanel';

/** `params` is a union over behaviors; these tests only use workstations. */
const laborOf = (e: { params: object }) => (e.params as { labor: Labor }).labor;
let store: ReturnType<typeof createEditorStore>;
beforeEach(() => {
  localStorage.clear();
  store = createEditorStore();
  store.getState().setUnit('m');
});
afterEach(cleanup);

describe('TechniciansPanel (TE-1)', () => {
  it('creates a tech with name and walk speed 1.2 m/s, and edits both', async () => {
    const user = userEvent.setup();
    render(<TechniciansPanel useStore={store} />);
    await user.click(screen.getByRole('button', { name: /add technician/i }));
    expect((screen.getByLabelText(/technician name/i) as HTMLInputElement).value).toBe('Tech 1');
    expect((screen.getByLabelText(/walk speed/i) as HTMLInputElement).value).toBe('1.2');
    const name = screen.getByLabelText(/technician name/i);
    await user.clear(name);
    await user.type(name, 'Ana');
    const speed = screen.getByLabelText(/walk speed/i);
    await user.clear(speed);
    await user.type(speed, '1.5');
    expect(store.getState().technicians[0]).toMatchObject({ name: 'Ana', walkSpeed: 1.5 });
  });
});

describe('TechniciansPanel walk speed units (TE-1)', () => {
  it('shows ft/min in ft and stores m/s', async () => {
    const user = userEvent.setup();
    store.getState().setUnit('ft');
    store.getState().addTechnician();
    render(<TechniciansPanel useStore={store} />);
    const speed = screen.getByLabelText(/walk speed \(ft\/min\)/i) as HTMLInputElement;
    expect(Number(speed.value)).toBeCloseTo(236.22, 1);
    await user.clear(speed);
    await user.type(speed, '300');
    expect(store.getState().technicians[0]!.walkSpeed).toBeCloseTo(1.524, 3);
  });
});

describe('Workstation labor editor in PropertiesPanel (TE-1)', () => {
  const setup = () => {
    const a = store.getState().placeEquipment('base-workstation', { x: 3, y: 3 })!;
    store.getState().selectEquipment(a.id, true);
    store.getState().addTechnician();
    render(<PropertiesPanel useStore={store} />);
    return a;
  };

  it('assigns a tech with a checkbox', async () => {
    const user = userEvent.setup();
    const a = setup();
    await user.click(await screen.findByRole('checkbox', { name: /tech 1/i }));
    expect(store.getState().technicians[0]!.stationIds).toEqual([a.id]);
  });

  it('switches between manual and automatic and edits load / unload times', async () => {
    const user = userEvent.setup();
    setup();
    expect(
      ((await screen.findByRole('radio', { name: /manual/i })) as HTMLInputElement).checked,
    ).toBe(true);
    expect(screen.queryByLabelText(/load time/i)).toBeNull();
    await user.click(screen.getByRole('radio', { name: /automatic/i }));
    expect(laborOf(store.getState().equipment[0]!).mode).toBe('automatic');
    const load = screen.getByLabelText(/^load time/i);
    await user.clear(load);
    await user.type(load, '12{Enter}');
    expect(laborOf(store.getState().equipment[0]!)).toMatchObject({
      loadTime: { kind: 'fixed', value: 12 },
    });
    expect(screen.getByLabelText(/^unload time/i)).toBeTruthy();
  });

  it('takes a distribution for the load time', async () => {
    const user = userEvent.setup();
    setup();
    await user.click(await screen.findByRole('radio', { name: /automatic/i }));
    await user.selectOptions(screen.getByLabelText('Distribution, Load time'), 'normal');
    await user.type(screen.getByLabelText('Mean, Load time'), '10{Enter}');
    await user.type(screen.getByLabelText('Std dev, Load time'), '2{Enter}');
    expect(laborOf(store.getState().equipment[0]!)).toMatchObject({
      loadTime: { kind: 'normal', mean: 10, stdDev: 2 },
    });
  });
});
