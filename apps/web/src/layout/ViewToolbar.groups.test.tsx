import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViewToolbar } from './ViewToolbar';
import { createEditorStore } from './editorStore';

afterEach(cleanup);
const group = (name: string) => screen.getByRole('group', { name });

describe('UI-3 AC3: toolbar groups and shortcut tooltips', () => {
  it('groups View, Edit, Connect and Clearance', () => {
    render(<ViewToolbar useStore={createEditorStore()} />);
    expect(within(group('View')).getByRole('button', { name: '3D' })).toBeTruthy();
    expect(within(group('View')).getByRole('button', { name: /zoom to fit/i })).toBeTruthy();
    for (const n of ['Undo', 'Redo', 'Delete'])
      expect(within(group('Edit')).getByRole('button', { name: n })).toBeTruthy();
    expect(group('Connect')).toBeTruthy();
    expect(within(group('Clearance')).getByLabelText(/minimum clearance/i)).toBeTruthy();
  });

  it('puts keyboard shortcuts in tooltips', () => {
    render(<ViewToolbar useStore={createEditorStore()} />);
    expect(screen.getByRole('button', { name: 'Undo' }).title).toMatch(/Ctrl\+Z/);
    expect(screen.getByRole('button', { name: 'Redo' }).title).toMatch(/Ctrl\+Shift\+Z/);
    expect(screen.getByRole('button', { name: 'Delete' }).title).toMatch(/Del/);
  });

  it('Undo, Redo and Delete act on the document', async () => {
    const store = createEditorStore();
    render(<ViewToolbar useStore={store} />);
    const user = userEvent.setup();
    const undo = screen.getByRole('button', { name: 'Undo' }) as HTMLButtonElement;
    expect(undo.disabled).toBe(true);
    const e = store.getState().placeEquipment('base-workstation', { x: 5, y: 5 })!;
    expect(undo.disabled).toBe(false);
    store.getState().selectEquipment(e.id, true);
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(store.getState().equipment).toHaveLength(0);
    await user.click(undo);
    expect(store.getState().equipment).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(store.getState().equipment).toHaveLength(0);
  });

  it('Connect group offers Cancel only while a connection is being drawn', async () => {
    const store = createEditorStore();
    const a = store.getState().placeEquipment('base-source', { x: 2, y: 2 })!;
    render(<ViewToolbar useStore={store} />);
    expect(within(group('Connect')).queryByRole('button', { name: /cancel/i })).toBeNull();
    store
      .getState()
      .clickPort({ equipmentId: a.id, portId: a.ports.find((p) => p.kind === 'output')!.id });
    await userEvent
      .setup()
      .click(await within(group('Connect')).findByRole('button', { name: /cancel/i }));
    expect(store.getState().pendingFrom).toBeNull();
  });
});
