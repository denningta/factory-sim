import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createProject, defaultPorts, type EquipmentType } from '@factory-sim/schema';
import { LibrarySection, type LibraryApi } from './LibrarySection';
import { useEditorStore } from '../layout/editorStore';

afterEach(cleanup);

const cnc: EquipmentType = {
  id: '11111111-1111-4111-8111-111111111111',
  name: '5-axis CNC',
  behavior: 'workstation',
  params: { capacity: 1, batchSize: 1, labor: { mode: 'manual' } },
  footprint: { width: 3, length: 2.5 },
  height: 2.4,
  color: '#2f6f9f',
  ports: defaultPorts('workstation'),
};

function fakeApi(initial: EquipmentType[]): LibraryApi {
  let list = initial;
  return {
    listEquipmentTypes: vi.fn(async () => list),
    createEquipmentType: vi.fn(async (t: EquipmentType) => {
      list = [...list, t];
      return t;
    }),
    updateEquipmentType: vi.fn(async (t: EquipmentType) => {
      list = list.map((x) => (x.id === t.id ? t : x));
      return t;
    }),
    deleteEquipmentType: vi.fn(async (id: string) => {
      list = list.filter((x) => x.id !== id);
    }),
  };
}

beforeEach(() => {
  useEditorStore.getState().loadDocument(createProject());
  useEditorStore.getState().setUserTypes([]);
});

async function createCnc() {
  await userEvent.click(screen.getByRole('button', { name: /new type/i }));
  await userEvent.type(screen.getByLabelText(/^name/i), '5-axis CNC');
  await userEvent.click(screen.getByRole('button', { name: /save type/i }));
}

describe('LibrarySection', () => {
  it('AC2: loads my saved types and lists them after the built-ins', async () => {
    render(<LibrarySection api={fakeApi([cnc])} unit="m" />);
    const item = await screen.findByRole('listitem', { name: '5-axis CNC' });
    expect(within(item).getByText(/3 × 2\.5 m/)).toBeTruthy();
    const names = screen.getAllByRole('listitem').map((i) => i.getAttribute('aria-label'));
    expect(names.indexOf('5-axis CNC')).toBe(names.length - 1);
  });

  it('AC1/AC2: a type I create is saved to my library and appears in the list', async () => {
    const api = fakeApi([]);
    render(<LibrarySection api={api} unit="m" />);
    await screen.findByRole('button', { name: /new type/i });
    await createCnc();
    expect(await screen.findByRole('listitem', { name: '5-axis CNC' })).toBeTruthy();
    expect(api.createEquipmentType).toHaveBeenCalledOnce();
    expect(useEditorStore.getState().userTypes.map((t) => t.name)).toEqual(['5-axis CNC']);
  });

  it('AC2: a type that fails to save is reported and not added', async () => {
    const api = fakeApi([]);
    api.createEquipmentType = vi.fn(async () => {
      throw new Error('Cannot reach the server');
    });
    render(<LibrarySection api={api} unit="m" />);
    await screen.findByRole('button', { name: /new type/i });
    await createCnc();
    expect((await screen.findByRole('alert')).textContent).toMatch(/cannot reach/i);
    expect(useEditorStore.getState().userTypes).toEqual([]);
  });

  it('AC3: after editing a type with placed instances I am offered to update them', async () => {
    useEditorStore.getState().setUserTypes([cnc]);
    useEditorStore.getState().placeEquipment(cnc.id, { x: 5, y: 5 });
    const api = fakeApi([cnc]);
    render(<LibrarySection api={api} unit="m" />);
    const item = await screen.findByRole('listitem', { name: '5-axis CNC' });
    await userEvent.click(within(item).getByRole('button', { name: /edit/i }));
    await userEvent.clear(screen.getByLabelText(/^height/i));
    await userEvent.type(screen.getByLabelText(/^height/i), '4');
    await userEvent.click(screen.getByRole('button', { name: /save type/i }));
    // Saved, but the placed instance still has its own settings until I accept.
    await screen.findByText(/1 placed instance uses this type/i);
    expect(useEditorStore.getState().equipment[0]!.height).toBe(2.4);
    await userEvent.click(screen.getByRole('button', { name: /update instance/i }));
    expect(useEditorStore.getState().equipment[0]!.height).toBe(4);
  });

  it('AC3: I can decline the offer and instances keep their settings', async () => {
    useEditorStore.getState().setUserTypes([cnc]);
    useEditorStore.getState().placeEquipment(cnc.id, { x: 5, y: 5 });
    render(<LibrarySection api={fakeApi([cnc])} unit="m" />);
    const item = await screen.findByRole('listitem', { name: '5-axis CNC' });
    await userEvent.click(within(item).getByRole('button', { name: /edit/i }));
    await userEvent.clear(screen.getByLabelText(/^height/i));
    await userEvent.type(screen.getByLabelText(/^height/i), '4');
    await userEvent.click(screen.getByRole('button', { name: /save type/i }));
    await userEvent.click(await screen.findByRole('button', { name: /keep/i }));
    expect(screen.queryByText(/placed instance/i)).toBeNull();
    expect(useEditorStore.getState().equipment[0]!.height).toBe(2.4);
    expect(useEditorStore.getState().userTypes[0]!.height).toBe(4);
  });

  it('AC3: no offer when no instance uses the type', async () => {
    useEditorStore.getState().setUserTypes([cnc]);
    render(<LibrarySection api={fakeApi([cnc])} unit="m" />);
    const item = await screen.findByRole('listitem', { name: '5-axis CNC' });
    await userEvent.click(within(item).getByRole('button', { name: /edit/i }));
    await userEvent.click(screen.getByRole('button', { name: /save type/i }));
    await waitFor(() => expect(screen.queryByLabelText(/^name/i)).toBeNull());
    expect(screen.queryByText(/placed instance/i)).toBeNull();
  });

  it('AC2: deleting a type removes it from the library and leaves instances in place', async () => {
    useEditorStore.getState().setUserTypes([cnc]);
    useEditorStore.getState().placeEquipment(cnc.id, { x: 5, y: 5 });
    const api = fakeApi([cnc]);
    render(<LibrarySection api={api} unit="m" />);
    const item = await screen.findByRole('listitem', { name: '5-axis CNC' });
    await userEvent.click(within(item).getByRole('button', { name: /delete/i }));
    await waitFor(() => expect(screen.queryByRole('listitem', { name: '5-axis CNC' })).toBeNull());
    expect(api.deleteEquipmentType).toHaveBeenCalledWith(cnc.id);
    expect(useEditorStore.getState().equipment).toHaveLength(1);
  });

  it('AC3: if the update would break the project, the offer says why and nothing changes', async () => {
    useEditorStore.getState().setUserTypes([cnc]);
    useEditorStore.getState().placeEquipment(cnc.id, { x: 5, y: 5 });
    render(<LibrarySection api={fakeApi([cnc])} unit="m" />);
    const item = await screen.findByRole('listitem', { name: '5-axis CNC' });
    await userEvent.click(within(item).getByRole('button', { name: /edit/i }));
    await userEvent.click(screen.getByRole('button', { name: /save type/i }));
    useEditorStore.setState({
      syncInstancesToType: () => ({ ok: false, error: 'Product A is routed through it' }),
    });
    await userEvent.click(await screen.findByRole('button', { name: /update instances/i }));
    expect((await screen.findByRole('alert')).textContent).toMatch(/routed through it/);
    expect(screen.getByRole('button', { name: /update instances/i })).toBeTruthy();
  });
});
