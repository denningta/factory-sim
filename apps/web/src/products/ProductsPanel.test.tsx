import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createEditorStore } from '../layout/editorStore';
import { ProductsPanel } from './ProductsPanel';

let store: ReturnType<typeof createEditorStore>;
beforeEach(() => {
  localStorage.clear();
  store = createEditorStore();
  render(<ProductsPanel useStore={store} />);
});
afterEach(cleanup);

describe('ProductsPanel', () => {
  it('warns that a run needs a product while there are none', async () => {
    expect(await screen.findByText(/at least one product/i)).toBeTruthy();
  });

  it('adds a product, edits its fields and the warning goes away', async () => {
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /add product/i }));
    expect(screen.queryByText(/at least one product/i)).toBeNull();
    const part = screen.getByLabelText(/part number/i);
    await user.clear(part);
    await user.type(part, 'A-100');
    const name = screen.getByLabelText(/^name/i);
    await user.clear(name);
    await user.type(name, 'Gearbox');
    expect(store.getState().products[0]).toMatchObject({ partNumber: 'A-100', name: 'Gearbox' });
    expect(screen.getByLabelText(/color/i)).toBeTruthy();
  });

  it('shows an error for a duplicate part number and keeps the stored one', async () => {
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /add product/i }));
    store.getState().updateProduct(store.getState().products[0]!.id, { partNumber: 'A-100' });
    await user.click(screen.getByRole('button', { name: /add product/i }));
    const part = screen.getByLabelText(/part number/i);
    await user.clear(part);
    await user.type(part, 'A-100');
    expect((await screen.findByRole('alert')).textContent).toMatch(/already used/i);
    expect(store.getState().products[1]!.partNumber).not.toBe('A-100');
  });

  it('deletes the selected product', async () => {
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /add product/i }));
    await user.click(screen.getByRole('button', { name: /delete product/i }));
    expect(store.getState().products).toEqual([]);
    expect(await screen.findByText(/at least one product/i)).toBeTruthy();
  });

  it('one color change is one undo step', async () => {
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /add product/i }));
    const before = store.getState().products[0]!.color;
    const color = screen.getByLabelText(/color/i) as HTMLInputElement;
    color.focus();
    for (const c of ['#111111', '#222222', '#333333'])
      fireEvent.change(color, { target: { value: c } });
    color.blur();
    expect(store.getState().products[0]!.color).toBe('#333333');
    store.getState().undo();
    expect(store.getState().products[0]!.color).toBe(before);
  });
});

describe('SE-5: ProductsPanel selection lives in the editor store', () => {
  it('shows the product named by selectedProductId', async () => {
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: /add product/i }));
    await user.click(screen.getByRole('button', { name: /add product/i }));
    const [a, b] = store.getState().products;
    act(() => store.getState().selectProduct(a!.id));
    expect(store.getState().selectedProductId).toBe(a!.id);
    act(() => store.getState().selectProduct(b!.id));
    const row = screen.getAllByRole('button', { pressed: true })[0]!;
    expect(row.textContent).toContain(b!.name);
  });
});
