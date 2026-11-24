import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PropertiesPanel } from '../layout/PropertiesPanel';
import { createEditorStore } from '../layout/editorStore';

let store: ReturnType<typeof createEditorStore>;
let stationId: string;
const HINT = /parallel units limited by assigned techs/i;

beforeEach(() => {
  localStorage.clear();
  store = createEditorStore();
  store.getState().setUnit('m');
  stationId = store.getState().placeEquipment('base-workstation', { x: 3, y: 3 })!.id;
  store.getState().selectEquipment(stationId, true);
  store.getState().addTechnician();
  render(<PropertiesPanel useStore={store} />);
});
afterEach(cleanup);

const setCapacity = async (n: string) => {
  const user = userEvent.setup();
  const cap = await screen.findByLabelText(/^capacity/i);
  await user.clear(cap);
  await user.type(cap, `${n}{Enter}`);
};

describe('WS-4 techs-limit hint', () => {
  it('AC1: shows for a manual station with capacity > assigned techs and updates live', async () => {
    const user = userEvent.setup();
    await setCapacity('3');
    expect((await screen.findByText(HINT)).textContent).toMatch(/\(0\)/);
    await user.click(screen.getByRole('checkbox', { name: /tech 1/i }));
    expect(screen.getByText(HINT).textContent).toMatch(/\(1\)/);
    await setCapacity('1');
    expect(screen.queryByText(HINT)).toBeNull();
    await setCapacity('2');
    expect(screen.getByText(HINT).textContent).toMatch(/\(1\)/);
    act(() => {
      store.getState().addTechnician();
      store.getState().setTechnicianStation('tech-2', stationId, true);
    });
    expect(screen.queryByText(HINT)).toBeNull();
  });

  it('AC2: no hint for automatic stations or when techs >= capacity', async () => {
    const user = userEvent.setup();
    await setCapacity('3');
    await screen.findByText(HINT);
    await user.click(screen.getByRole('radio', { name: /automatic/i }));
    expect(screen.queryByText(HINT)).toBeNull();
    await user.click(screen.getByRole('radio', { name: /manual/i }));
    await screen.findByText(HINT);
    await setCapacity('1');
    await user.click(screen.getByRole('checkbox', { name: /tech 1/i }));
    expect(screen.queryByText(HINT)).toBeNull();
  });
});
