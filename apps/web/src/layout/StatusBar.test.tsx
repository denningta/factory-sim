import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { StatusBar } from './StatusBar';
import { createEditorStore } from './editorStore';

afterEach(cleanup);

describe('UI-3 AC4: status bar', () => {
  it('shows units, snap and the selected object', async () => {
    const store = createEditorStore();
    store.getState().setUnit('ft');
    render(<StatusBar useStore={store} />);
    expect(screen.getByText(/units: ft/i)).toBeTruthy();
    expect(screen.getByText(/snap: on/i)).toBeTruthy();
    expect(screen.getByText(/selected: none/i)).toBeTruthy();
    const e = store.getState().placeEquipment('base-workstation', { x: 5, y: 5 })!;
    store.getState().selectEquipment(e.id, true);
    expect(await screen.findByText(`Selected: ${e.name}`)).toBeTruthy();
  });

  it('shows the overlap count; clicking it selects the first overlapping object', async () => {
    const store = createEditorStore();
    render(<StatusBar useStore={store} />);
    expect(screen.getByText(/no layout issues/i)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /layout issue/i })).toBeNull();
    const a = store.getState().placeEquipment('base-workstation', { x: 5, y: 5 })!;
    store.getState().placeEquipment('base-workstation', { x: 5.5, y: 5 });
    const btn = await screen.findByRole('button', { name: /1 layout issue\b/i });
    await userEvent.setup().click(btn);
    expect(store.getState().selectedIds).toEqual([a.id]);
  });
});
