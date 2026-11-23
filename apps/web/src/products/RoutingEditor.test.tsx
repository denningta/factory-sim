import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Equipment } from '@factory-sim/schema';
import { createEditorStore } from '../layout/editorStore';
import { ProductsPanel } from './ProductsPanel';

let store: ReturnType<typeof createEditorStore>;
const place = (typeId: string, x: number, name: string): Equipment => {
  const e = store.getState().placeEquipment(typeId, { x, y: 2 })!;
  store.getState().updateEquipment(e.id, { name });
  return store.getState().equipment.find((q) => q.id === e.id)!;
};
beforeEach(() => {
  localStorage.clear();
  store = createEditorStore();
});
afterEach(cleanup);

const steps = () => within(screen.getByRole('list', { name: /routing steps/i }));
const stationsOf = (i: number) => store.getState().products[i]!.routing.map((s) => s.stationId);

describe('PR-2 routing editor: add, reorder and remove steps, each assigned to a station', () => {
  it('asks for a workstation on the layout before steps can be added', async () => {
    store.getState().addProduct();
    render(<ProductsPanel useStore={store} />);
    expect(await screen.findByText(/place a workstation/i)).toBeTruthy();
    expect((screen.getByRole('button', { name: /add step/i }) as HTMLButtonElement).disabled).toBe(
      true,
    );
  });

  it('adds steps and assigns each to a station', async () => {
    const user = userEvent.setup();
    const saw = place('base-workstation', 2, 'Saw');
    const cnc = place('base-workstation', 5, 'CNC');
    place('base-buffer', 8, 'Rack'); // not a workstation: never offered
    store.getState().addProduct();
    render(<ProductsPanel useStore={store} />);
    expect(await screen.findByRole('heading', { name: /routing — product 1/i })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /add step/i }));
    await user.click(screen.getByRole('button', { name: /add step/i }));
    expect(stationsOf(0)).toEqual([saw.id, saw.id]);
    const second = screen.getByLabelText(/station for step 2/i) as HTMLSelectElement;
    expect([...second.options].map((o) => o.text)).toEqual(['Saw', 'CNC']);
    await user.selectOptions(second, cnc.id);
    expect(stationsOf(0)).toEqual([saw.id, cnc.id]);
  });

  it('moves steps up and down and removes them', async () => {
    const user = userEvent.setup();
    const [a, b, c] = [2, 5, 8].map((x, i) => place('base-workstation', x, `S${i + 1}`));
    const p = store.getState().addProduct();
    for (const s of [a!, b!, c!]) store.getState().addRoutingStep(p.id, s.id);
    render(<ProductsPanel useStore={store} />);
    await user.click(await screen.findByRole('button', { name: /move step 3 up/i }));
    expect(stationsOf(0)).toEqual([a!.id, c!.id, b!.id]);
    await user.click(screen.getByRole('button', { name: /move step 1 down/i }));
    expect(stationsOf(0)).toEqual([c!.id, a!.id, b!.id]);
    await user.click(screen.getByRole('button', { name: /remove step 2/i }));
    expect(stationsOf(0)).toEqual([c!.id, b!.id]);
    expect(steps().getAllByRole('listitem')).toHaveLength(2);
  });

  it('drags a step to a new position', async () => {
    const [a, b, c] = [2, 5, 8].map((x, i) => place('base-workstation', x, `S${i + 1}`));
    const p = store.getState().addProduct();
    for (const s of [a!, b!, c!]) store.getState().addRoutingStep(p.id, s.id);
    render(<ProductsPanel useStore={store} />);
    await screen.findByRole('list', { name: /routing steps/i });
    const rows = steps().getAllByRole('listitem');
    fireEvent.dragStart(rows[2]!);
    fireEvent.dragOver(rows[0]!);
    fireEvent.drop(rows[0]!);
    expect(stationsOf(0)).toEqual([c!.id, a!.id, b!.id]);
  });

  it('shows the selected product’s routing', async () => {
    const user = userEvent.setup();
    const a = place('base-workstation', 2, 'Saw');
    const b = place('base-workstation', 5, 'Weld');
    const p1 = store.getState().addProduct();
    const p2 = store.getState().addProduct();
    store.getState().addRoutingStep(p1.id, a.id);
    store.getState().addRoutingStep(p2.id, b.id);
    render(<ProductsPanel useStore={store} />);
    expect(
      (steps().getByLabelText(/station for step 1/i) as HTMLSelectElement).selectedOptions[0]!.text,
    ).toBe('Saw');
    await user.click(screen.getByRole('button', { name: /product 2/i }));
    expect(
      (steps().getByLabelText(/station for step 1/i) as HTMLSelectElement).selectedOptions[0]!.text,
    ).toBe('Weld');
  });
});

describe('PR-2 the same station can appear in many products’ routings (UI)', () => {
  it('a station used by one product is still offered to another', async () => {
    const user = userEvent.setup();
    const saw = place('base-workstation', 2, 'Saw');
    const p1 = store.getState().addProduct();
    store.getState().addRoutingStep(p1.id, saw.id);
    store.getState().addProduct();
    render(<ProductsPanel useStore={store} />);
    await user.click(await screen.findByRole('button', { name: /product 2/i }));
    await user.click(screen.getByRole('button', { name: /add step/i }));
    expect(stationsOf(1)).toEqual([saw.id]);
    expect(stationsOf(0)).toEqual([saw.id]);
  });
});

describe('PR-2 steps whose station is unreachable by connections are flagged (UI)', () => {
  it('flags only the step whose station no source can reach', async () => {
    const src = place('base-source', 1, 'Release');
    const fed = place('base-workstation', 4, 'Fed');
    const island = place('base-workstation', 7, 'Island');
    const p = store.getState().addProduct();
    store.getState().addRoutingStep(p.id, fed.id);
    store.getState().addRoutingStep(p.id, island.id);
    store.getState().loadDocument({
      schemaVersion: 3,
      floor: store.getState().floor,
      equipment: store.getState().equipment,
      products: store.getState().products,
      cycleTimes: [],
      connections: [
        {
          id: 'cn-1',
          from: { equipmentId: src.id, portId: 'out' },
          to: { equipmentId: fed.id, portId: 'in' },
          capacity: 0,
        },
      ],
    });
    render(<ProductsPanel useStore={store} />);
    const rows = (await screen.findByRole('list', { name: /routing steps/i })).querySelectorAll(
      'li',
    );
    expect(within(rows[0]!).queryByText(/not reachable/i)).toBeNull();
    expect(within(rows[1]!).getByText(/not reachable/i)).toBeTruthy();
  });
});
