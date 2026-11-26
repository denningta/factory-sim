import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RightPanel } from './RightPanel';
import { createEditorStore } from './editorStore';
import { resetSectionMemory } from '../ui/Section';

let store: ReturnType<typeof createEditorStore>;
beforeEach(() => {
  localStorage.clear();
  resetSectionMemory();
  store = createEditorStore();
  store.getState().setUnit('m');
});
afterEach(cleanup);

const heading = (name: string) => screen.queryByRole('heading', { name: new RegExp(name, 'i') });
const placeSelected = () => {
  const e = store.getState().placeEquipment('base-workstation', { x: 3, y: 3 })!;
  store.getState().selectEquipment(e.id, true);
  return e;
};

describe('UI-3 AC2: right panel follows the selection', () => {
  it('nothing selected shows Floor settings and Technicians only', () => {
    render(<RightPanel useStore={store} />);
    expect(heading('Floor')).toBeTruthy();
    expect(heading('Technicians')).toBeTruthy();
    expect(heading('General')).toBeNull();
  });

  it('equipment selected shows General, Size & position, Process and Staffing', () => {
    placeSelected();
    render(<RightPanel useStore={store} />);
    for (const h of ['General', 'Size & position', 'Process', 'Staffing'])
      expect(heading(h), h).toBeTruthy();
    expect(heading('Floor')).toBeNull();
    expect(heading('Technicians')).toBeNull();
    expect(screen.getByLabelText(/^name/i)).toBeTruthy();
    expect(screen.getByLabelText(/capacity/i)).toBeTruthy();
    expect(screen.getByLabelText(/position x/i)).toBeTruthy();
  });

  it('General shows the type and model read-only', () => {
    placeSelected();
    render(<RightPanel useStore={store} />);
    expect(screen.getByTestId('type').textContent).toMatch(/workstation/i);
    expect(screen.getByTestId('model')).toBeTruthy();
  });

  it('Process summarises cycle times and links to Products & routings', async () => {
    const e = placeSelected();
    const onOpenProducts = vi.fn();
    render(<RightPanel useStore={store} onOpenProducts={onOpenProducts} />);
    expect(screen.getByText(/no cycle times/i)).toBeTruthy();
    await userEvent.setup().click(screen.getByRole('button', { name: /products & routings/i }));
    expect(onOpenProducts).toHaveBeenCalledOnce();
    expect(e.id).toBeTruthy();
  });

  it('Staffing says what to do when there are no technicians', () => {
    placeSelected();
    render(<RightPanel useStore={store} />);
    expect(screen.getByText(/add a technician, then assign stations/i)).toBeTruthy();
  });

  it('connection selected shows Buffer & transfer', () => {
    const a = store.getState().placeEquipment('base-source', { x: 2, y: 2 })!;
    const b = store.getState().placeEquipment('base-workstation', { x: 6, y: 2 })!;
    const from = a.ports.find((p) => p.kind === 'output')!;
    const to = b.ports.find((p) => p.kind === 'input')!;
    expect(
      store
        .getState()
        .connect({ equipmentId: a.id, portId: from.id }, { equipmentId: b.id, portId: to.id }).ok,
    ).toBe(true);
    render(<RightPanel useStore={store} />);
    expect(heading('Buffer & transfer')).toBeTruthy();
    expect(heading('Floor')).toBeNull();
  });

  it('each section remembers whether it is open for the session', async () => {
    placeSelected();
    const user = userEvent.setup();
    const first = render(<RightPanel useStore={store} />);
    const toggle = () => screen.getByRole('button', { name: /^.?\s*General/ });
    expect(toggle().getAttribute('aria-expanded')).toBe('true');
    await user.click(toggle());
    first.unmount();
    render(<RightPanel useStore={store} />);
    expect(toggle().getAttribute('aria-expanded')).toBe('false');
    // other sections are unaffected
    expect(screen.getByRole('button', { name: /Process/ }).getAttribute('aria-expanded')).toBe(
      'true',
    );
  });
});
