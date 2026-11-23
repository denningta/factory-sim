import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createEditorStore } from '../layout/editorStore';
import { ProductsPanel } from './ProductsPanel';

let store: ReturnType<typeof createEditorStore>;
const s = () => store.getState();
function setup() {
  const mk = (x: number, name: string) => {
    const e = s().placeEquipment('base-workstation', { x, y: 2 })!;
    s().updateEquipment(e.id, { name });
    return e.id;
  };
  const saw = mk(2, 'Saw');
  const cnc = mk(5, 'CNC');
  const p1 = s().addProduct();
  const p2 = s().addProduct();
  s().addRoutingStep(p1.id, saw);
  s().addRoutingStep(p1.id, cnc);
  s().addRoutingStep(p2.id, saw);
  return { saw, cnc, p1, p2 };
}
beforeEach(() => {
  localStorage.clear();
  store = createEditorStore();
});
afterEach(cleanup);

const grid = () => screen.getByRole('table', { name: /cycle times/i });
const cell = (product: string, station: string) =>
  screen.queryByLabelText(`Cycle time, ${product} at ${station}`) as HTMLInputElement | null;

describe('PR-3 editable product × station grid, filled only where the routing uses that station', () => {
  it('has an input only where the product’s routing uses the station', async () => {
    setup();
    render(<ProductsPanel useStore={store} />);
    await screen.findByRole('table', { name: /cycle times/i });
    expect(
      within(grid())
        .getAllByRole('columnheader')
        .map((h) => h.textContent),
    ).toEqual(expect.arrayContaining(['Saw', 'CNC']));
    expect(cell('Product 1', 'Saw')).toBeTruthy();
    expect(cell('Product 1', 'CNC')).toBeTruthy();
    expect(cell('Product 2', 'Saw')).toBeTruthy();
    expect(cell('Product 2', 'CNC')).toBeNull();
    expect(screen.getByLabelText('Product 2 does not use CNC')).toBeTruthy();
  });

  it('follows routing edits', async () => {
    const { cnc, p2 } = setup();
    render(<ProductsPanel useStore={store} />);
    await screen.findByRole('table', { name: /cycle times/i });
    expect(cell('Product 2', 'CNC')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /product 2/i }));
    s().addRoutingStep(p2.id, cnc);
    expect(await screen.findByLabelText('Cycle time, Product 2 at CNC')).toBeTruthy();
  });
});

describe('PR-3 each cell takes a fixed time', () => {
  it('typing seconds or mm:ss stores a fixed time in seconds', async () => {
    const user = userEvent.setup();
    const { saw, cnc, p1 } = setup();
    render(<ProductsPanel useStore={store} />);
    await screen.findByRole('table', { name: /cycle times/i });
    await user.type(cell('Product 1', 'Saw')!, '45');
    await user.type(cell('Product 1', 'CNC')!, '1:30');
    expect(s().cycleTimes).toEqual(
      expect.arrayContaining([
        { productId: p1.id, stationId: saw, time: { kind: 'fixed', value: 45 } },
        { productId: p1.id, stationId: cnc, time: { kind: 'fixed', value: 90 } },
      ]),
    );
  });

  it('shows stored values and rejects invalid text without touching the store', async () => {
    const user = userEvent.setup();
    const { saw, p1 } = setup();
    s().setCycleTime(p1.id, saw, 30);
    render(<ProductsPanel useStore={store} />);
    const input = (await screen.findByLabelText(
      'Cycle time, Product 1 at Saw',
    )) as HTMLInputElement;
    expect(input.value).toBe('30');
    await user.type(input, 'x'); // appended: "30x"; clearing the cell would clear the stored time
    expect((await screen.findByRole('alert')).textContent).toMatch(/seconds|mm:ss/i);
    expect(s().cycleTimes[0]!.time).toEqual({ kind: 'fixed', value: 30 });
  });

  it('clearing a cell removes its cycle time', async () => {
    const user = userEvent.setup();
    const { saw, p1 } = setup();
    s().setCycleTime(p1.id, saw, 30);
    render(<ProductsPanel useStore={store} />);
    await user.clear(await screen.findByLabelText('Cycle time, Product 1 at Saw'));
    expect(s().cycleTimes).toEqual([]);
  });
});

describe('PR-3 missing cycle times are flagged before a run (UI)', () => {
  it('marks empty cells and lists the count in the issues, clearing as they are filled', async () => {
    const user = userEvent.setup();
    setup();
    render(<ProductsPanel useStore={store} />);
    await screen.findByRole('table', { name: /cycle times/i });
    expect(screen.getByText(/3 cycle times.*missing/i)).toBeTruthy();
    expect(cell('Product 1', 'Saw')!.getAttribute('aria-invalid')).toBe('true');
    await user.type(cell('Product 1', 'Saw')!, '10');
    await user.type(cell('Product 1', 'CNC')!, '10');
    await user.type(cell('Product 2', 'Saw')!, '10');
    expect(screen.queryByText(/cycle times? .*missing/i)).toBeNull();
    expect(cell('Product 1', 'Saw')!.getAttribute('aria-invalid')).toBeNull();
  });
});

describe('PR-3 import from CSV / paste from Excel (UI)', () => {
  it('imports pasted text, then reports skipped cells', async () => {
    const user = userEvent.setup();
    const { saw, cnc, p1, p2 } = setup();
    s().updateProduct(p1.id, { partNumber: 'A-100' });
    s().updateProduct(p2.id, { partNumber: 'B-200' });
    render(<ProductsPanel useStore={store} />);
    await screen.findByRole('table', { name: /cycle times/i });
    const box = screen.getByLabelText(/paste cycle times/i);
    fireEvent.change(box, {
      target: { value: 'Part\tSaw\tCNC\nA-100\t30\t1:30\nB-200\t45\t9\nZ-9\t1\t1' },
    });
    await user.click(screen.getByRole('button', { name: /^import$/i }));
    const times = Object.fromEntries(
      s().cycleTimes.map((c) => [`${c.productId}/${c.stationId}`, c.time]),
    );
    expect(times).toEqual({
      [`${p1.id}/${saw}`]: { kind: 'fixed', value: 30 },
      [`${p1.id}/${cnc}`]: { kind: 'fixed', value: 90 },
      [`${p2.id}/${saw}`]: { kind: 'fixed', value: 45 },
    });
    expect(cell('Product 1', 'CNC')!.value).toBe('90');
    const status = await screen.findByRole('status');
    expect(status.textContent).toMatch(/imported 3/i);
    expect(status.textContent).toMatch(/Z-9/);
    expect(status.textContent).toMatch(/B-200.*CNC|CNC.*B-200/);
  });

  it('imports a chosen CSV file', async () => {
    const user = userEvent.setup();
    const { saw, p1 } = setup();
    s().updateProduct(p1.id, { partNumber: 'A-100' });
    render(<ProductsPanel useStore={store} />);
    await screen.findByRole('table', { name: /cycle times/i });
    const file = new File(['part,Saw\nA-100,12'], 'times.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText(/import csv file/i), file);
    expect(await screen.findByDisplayValue('12')).toBeTruthy();
    expect(s().cycleTimes).toEqual([
      { productId: p1.id, stationId: saw, time: { kind: 'fixed', value: 12 } },
    ]);
  });
});
