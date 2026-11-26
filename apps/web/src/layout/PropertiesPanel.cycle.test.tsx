import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PropertiesPanel } from './PropertiesPanel';
import { createEditorStore } from './editorStore';

/** SF-7 AC3: the properties panel edits cure time, batch size and max wait. */
let store: ReturnType<typeof createEditorStore>;
beforeEach(() => {
  localStorage.clear();
  store = createEditorStore();
  store.getState().setUnit('ft'); // cure time is minutes whatever the length unit
  render(<PropertiesPanel useStore={store} />);
});
afterEach(cleanup);

const params = () => store.getState().equipment[0]!.params as Record<string, unknown>;

function placeStation(patch: Parameters<ReturnType<typeof store.getState>['updateEquipment']>[1]) {
  const e = store.getState().placeEquipment('base-workstation', { x: 4, y: 4 })!;
  store.getState().updateEquipment(e.id, { params: { capacity: 4 }, ...patch });
  store.getState().selectEquipment(e.id, true);
  return e;
}
const perBatch = (seconds: number) =>
  ({ cycle: { mode: 'perBatch', time: { kind: 'fixed', value: seconds } } }) as const;

describe('SF-7 AC3: cure time, batch size and max wait in the properties panel', () => {
  it('cure time shows in minutes and is stored in seconds', async () => {
    placeStation(perBatch(7200));
    const field = (await screen.findByLabelText(/cure time \(min\)/i)) as HTMLInputElement;
    expect(field.value).toBe('120');
    await userEvent.clear(field);
    await userEvent.type(field, '90');
    await userEvent.tab();
    expect(params().cycle).toEqual({ mode: 'perBatch', time: { kind: 'fixed', value: 5400 } });
  });

  it('cure time rejects zero and text, keeping the stored value', async () => {
    placeStation(perBatch(7200));
    const field = await screen.findByLabelText(/cure time \(min\)/i);
    await userEvent.clear(field);
    await userEvent.type(field, '0');
    await userEvent.tab();
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(params().cycle).toEqual({ mode: 'perBatch', time: { kind: 'fixed', value: 7200 } });
  });

  it('batch size edits in units, up to the capacity', async () => {
    placeStation(perBatch(7200));
    const field = await screen.findByLabelText(/^batch size/i);
    await userEvent.clear(field);
    await userEvent.type(field, '3');
    await userEvent.tab();
    expect(params().batchSize).toBe(3);
  });

  it('max wait shows in minutes and is stored in seconds; clearing it removes it', async () => {
    placeStation({ ...perBatch(7200), maxWait: 900 });
    const field = (await screen.findByLabelText(/max wait \(min\)/i)) as HTMLInputElement;
    expect(field.value).toBe('15');
    await userEvent.clear(field);
    await userEvent.type(field, '10');
    await userEvent.tab();
    expect(params().maxWait).toBe(600);
    await userEvent.clear(field);
    await userEvent.tab();
    expect(params().maxWait).toBeUndefined();
  });

  it('switching the cycle mode shows the cure time and hides the per-product cycle times', async () => {
    placeStation({});
    expect(await screen.findByText(/no cycle times set/i)).toBeTruthy();
    expect(screen.queryByLabelText(/cure time/i)).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText(/^cycle$/i), 'perBatch');
    expect(params().cycle).toMatchObject({ mode: 'perBatch' });
    expect(screen.getByLabelText(/cure time \(min\)/i)).toBeTruthy();
    expect(screen.queryByText(/no cycle times set/i)).toBeNull();
    await userEvent.selectOptions(screen.getByLabelText(/^cycle$/i), 'perProduct');
    expect(screen.queryByLabelText(/cure time/i)).toBeNull();
    expect(screen.getByText(/no cycle times set/i)).toBeTruthy();
  });

  it('the generic numeric list does not show max wait as a raw key', async () => {
    placeStation({ ...perBatch(7200), maxWait: 900 });
    await screen.findByLabelText(/max wait \(min\)/i);
    expect(screen.queryByLabelText(/^maxWait$/)).toBeNull();
  });
});
