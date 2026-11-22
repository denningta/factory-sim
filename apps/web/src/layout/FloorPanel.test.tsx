import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FloorPanel } from './FloorPanel';
import { createEditorStore } from './editorStore';

let store: ReturnType<typeof createEditorStore>;
beforeEach(() => {
  localStorage.clear();
  store = createEditorStore();
  store.getState().setUnit('ft');
  render(<FloorPanel useStore={store} />);
});
afterEach(cleanup);

describe('FloorPanel', () => {
  it('I can set floor width and length in ft (stored as meters)', async () => {
    const user = userEvent.setup();
    const width = screen.getByLabelText(/floor width/i);
    await user.clear(width);
    await user.type(width, '120');
    const length = screen.getByLabelText(/floor length/i);
    await user.clear(length);
    await user.type(length, '80');
    expect(store.getState().floor.width).toBeCloseTo(36.576, 9);
    expect(store.getState().floor.length).toBeCloseTo(24.384, 9);
  });

  it('I can set floor width in m', async () => {
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(/units/i), 'm');
    const width = screen.getByLabelText(/floor width/i);
    await user.clear(width);
    await user.type(width, '50');
    expect(store.getState().floor.width).toBe(50);
  });

  it('switching units re-labels the fields but not the stored geometry', async () => {
    const user = userEvent.setup();
    const before = { ...store.getState().floor };
    expect((screen.getByLabelText(/floor width/i) as HTMLInputElement).value).toBe('98.43');
    await user.selectOptions(screen.getByLabelText(/units/i), 'm');
    expect((screen.getByLabelText(/floor width/i) as HTMLInputElement).value).toBe('30');
    expect(store.getState().floor).toEqual(before);
  });

  it('adjusts grid spacing', async () => {
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(/units/i), 'm');
    const spacing = screen.getByLabelText(/grid spacing/i);
    await user.clear(spacing);
    await user.type(spacing, '2.5');
    expect(store.getState().floor.gridSpacing).toBe(2.5);
  });

  it('shows an error and keeps the stored value for invalid input', async () => {
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText(/units/i), 'm');
    const width = screen.getByLabelText(/floor width/i);
    await user.clear(width);
    await user.type(width, '-4');
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(store.getState().floor.width).toBe(30);
  });

  it('toggles snap-to-grid', async () => {
    const user = userEvent.setup();
    const snap = screen.getByLabelText(/snap to grid/i) as HTMLInputElement;
    expect(snap.checked).toBe(true);
    await user.click(snap);
    expect(store.getState().snapEnabled).toBe(false);
  });
});
