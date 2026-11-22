import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
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
});
