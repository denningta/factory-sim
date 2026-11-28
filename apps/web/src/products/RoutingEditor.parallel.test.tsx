import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createEditorStore } from '../layout/editorStore';
import { ProductsPanel } from './ProductsPanel';
import { ParallelOffer } from '../layout/ParallelOffer';

let store: ReturnType<typeof createEditorStore>;
const s = () => store.getState();
const ws = (x: number, name: string) => {
  const e = s().placeEquipment('base-workstation', { x, y: 5 })!;
  s().updateEquipment(e.id, { name });
  return e.id;
};
beforeEach(() => {
  localStorage.clear();
  store = createEditorStore();
});
afterEach(cleanup);

describe('PS-2 AC1: the routing editor shows and edits a step’s parallel stations', () => {
  it('shows "Autoclave 1 or Autoclave 2" and adds/removes alternates', async () => {
    const user = userEvent.setup();
    const a1 = ws(10, 'Autoclave 1');
    ws(15, 'Autoclave 2');
    ws(20, 'Furnace');
    const pid = s().addProduct().id;
    s().addRoutingStep(pid, a1);
    render(<ProductsPanel useStore={store} />);
    const steps = within(await screen.findByRole('list', { name: /routing steps/i }));
    await user.click(steps.getByRole('button', { name: /\+ parallel station/i }));
    // The menu lists the eligible workstations; the primary is not one of them.
    const menu = within(screen.getByRole('menu', { name: /parallel station for step 1/i }));
    expect(menu.getAllByRole('menuitem').map((m) => m.textContent)).toEqual([
      'Autoclave 2',
      'Furnace',
    ]);
    await user.click(menu.getByRole('menuitem', { name: /autoclave 2/i }));
    expect(s().products[0]!.routing[0]!.alternates).toHaveLength(1);
    expect(steps.getByText(/Autoclave 1 or Autoclave 2|^or$/i)).toBeTruthy();
    await user.click(steps.getByRole('button', { name: /remove parallel station autoclave 2/i }));
    expect(s().products[0]!.routing[0]!.alternates ?? []).toEqual([]);
  });
  it('flags an alternate that is not connected', async () => {
    const a1 = ws(10, 'Autoclave 1');
    const a2 = ws(15, 'Autoclave 2');
    const pid = s().addProduct().id;
    const r = s().addRoutingStep(pid, a1);
    if (r.ok) s().addRoutingAlternate(pid, r.step.id, a2);
    render(<ProductsPanel useStore={store} />);
    expect(await screen.findAllByText(/not reachable from a source/i)).toBeTruthy();
  });
});

describe('PS-2 AC2: a copied cycle time is marked in the grid', () => {
  it('shows "copied" on the alternate cell until edited', async () => {
    const a1 = ws(10, 'Autoclave 1');
    const a2 = ws(15, 'Autoclave 2');
    const pid = s().addProduct().id;
    const r = s().addRoutingStep(pid, a1);
    s().setCycleTime(pid, a1, 90);
    if (r.ok) s().addRoutingAlternate(pid, r.step.id, a2);
    render(<ProductsPanel useStore={store} />);
    expect(await screen.findByText(/copied from autoclave 1/i)).toBeTruthy();
  });
});

describe('PS-2 AC3: the offer prompt', () => {
  it('asks "Use as parallel station for …?" and accepts', async () => {
    const user = userEvent.setup();
    const a1 = ws(10, 'Autoclave 1');
    const a2 = ws(15, 'Autoclave 2');
    const buf = s().placeEquipment('base-buffer', { x: 2, y: 5 })!.id;
    const pid = s().addProduct().id;
    s().addRoutingStep(pid, a1);
    s().connect({ equipmentId: buf, portId: 'out' }, { equipmentId: a1, portId: 'in' });
    s().connect({ equipmentId: buf, portId: 'out' }, { equipmentId: a2, portId: 'in' });
    render(<ParallelOffer useStore={store} />);
    expect(screen.getByText(/use as parallel station for/i)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /use as parallel/i }));
    expect(s().products[0]!.routing[0]!.alternates).toEqual([a2]);
    expect(screen.queryByText(/use as parallel station for/i)).toBeNull();
  });
});
