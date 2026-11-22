import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PropertiesPanel } from './PropertiesPanel';
import { createEditorStore } from './editorStore';

let store: ReturnType<typeof createEditorStore>;
beforeEach(() => {
  localStorage.clear();
  store = createEditorStore();
  store.getState().setUnit('m');
  render(<PropertiesPanel useStore={store} />);
});
afterEach(cleanup);

const place = (x: number, y: number) => {
  const e = store.getState().placeEquipment('base-workstation', { x, y })!;
  store.getState().selectEquipment(e.id, true);
  return e;
};

describe('PropertiesPanel', () => {
  it('prompts to select something when nothing is selected', async () => {
    expect(await screen.findByText(/select equipment/i)).toBeTruthy();
  });

  it('Position and rotation show in the properties panel', async () => {
    const e = place(4, 7);
    store.getState().setSelectedRotation(90);
    expect(await screen.findByText(e.name)).toBeTruthy();
    expect((screen.getByLabelText(/position x/i) as HTMLInputElement).value).toBe('4');
    expect((screen.getByLabelText(/position y/i) as HTMLInputElement).value).toBe('7');
    expect((screen.getByLabelText(/rotation/i) as HTMLInputElement).value).toBe('90');
  });

  it('shows position in the display unit (ft), stored as meters', async () => {
    store.getState().setUnit('ft');
    store.getState().toggleSnap(); // keep the exact typed position
    place(3.048, 0.3048 * 5);
    expect(((await screen.findByLabelText(/position x/i)) as HTMLInputElement).value).toBe('10');
    expect(store.getState().equipment[0]!.position.x).toBe(3.048);
  });

  it('I can rotate in 90° steps with buttons', async () => {
    const user = userEvent.setup();
    place(4, 4);
    await user.click(await screen.findByRole('button', { name: /rotate 90°/i }));
    expect(store.getState().equipment[0]!.rotation).toBeCloseTo(Math.PI / 2, 9);
    expect((screen.getByLabelText(/rotation/i) as HTMLInputElement).value).toBe('90');
  });

  it('I can type an angle', async () => {
    const user = userEvent.setup();
    place(4, 4);
    const field = await screen.findByLabelText(/rotation/i);
    await user.clear(field);
    await user.type(field, '45');
    expect(store.getState().equipment[0]!.rotation).toBeCloseTo(Math.PI / 4, 9);
  });

  it('with several selected it shows the count and a delete button removes them', async () => {
    const user = userEvent.setup();
    place(2, 2);
    place(6, 6);
    expect(await screen.findByText(/2 selected/i)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /delete/i }));
    expect(store.getState().equipment).toHaveLength(0);
  });
});
