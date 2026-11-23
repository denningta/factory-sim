import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createEditorStore } from '../layout/editorStore';
import { DemandPanel } from './DemandPanel';

let store: ReturnType<typeof createEditorStore>;
const s = () => store.getState();
beforeEach(() => {
  localStorage.clear();
  store = createEditorStore();
  s().addProduct();
  s().addProduct();
});
afterEach(cleanup);

describe('DemandPanel (PR-4)', () => {
  it('AC1: edits each product % of mix, and the other product follows', async () => {
    const user = userEvent.setup();
    const [a, b] = s().products;
    render(<DemandPanel useStore={store} />);
    const field = screen.getByLabelText(new RegExp(`${a!.name}.*% of mix`, 'i'));
    await user.clear(field);
    await user.type(field, '70');
    expect(s().demand.items.find((i) => i.productId === a!.id)?.value).toBe(70);
    expect(
      (screen.getByLabelText(new RegExp(`${b!.name}.*% of mix`, 'i')) as HTMLInputElement).value,
    ).toBe('30');
  });

  it('AC1: switches to units per shift', async () => {
    const user = userEvent.setup();
    render(<DemandPanel useStore={store} />);
    await user.selectOptions(screen.getByLabelText(/demand as/i), 'perShift');
    expect(s().demand.basis).toBe('perShift');
    expect(screen.getAllByLabelText(/units \/ shift/i).length).toBe(2);
  });

  it('AC2: offers the three release rules', async () => {
    const user = userEvent.setup();
    render(<DemandPanel useStore={store} />);
    const rule = screen.getByLabelText(/release rule/i);
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(
      expect.arrayContaining(['Fixed interval', 'Random by mix', 'Repeating sequence (heijunka)']),
    );
    await user.selectOptions(rule, 'random');
    expect(s().release.product.kind).toBe('random');
  });

  it('AC2: edits the sequence as text and shows a chip per step; unknown names are rejected', async () => {
    const user = userEvent.setup();
    const [a, b] = s().products;
    render(<DemandPanel useStore={store} />);
    await user.selectOptions(screen.getByLabelText(/release rule/i), 'sequence');
    const seq = screen.getByLabelText(/^sequence$/i);
    await user.clear(seq);
    await user.type(seq, `${a!.partNumber} ${a!.partNumber} ${b!.partNumber}`);
    expect(s().release.product).toEqual({ kind: 'sequence', pattern: [a!.id, a!.id, b!.id] });
    expect(screen.getAllByTestId('sequence-chip')).toHaveLength(3);
    await user.type(seq, ' ZZZ');
    expect(screen.getByRole('alert').textContent).toMatch(/ZZZ/);
    expect(s().release.product).toEqual({ kind: 'sequence', pattern: [a!.id, a!.id, b!.id] });
  });
});
