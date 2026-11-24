import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ViewToolbar } from './ViewToolbar';
import { BASE_EQUIPMENT_TYPES, instantiate } from '@factory-sim/schema';
import { createEditorStore } from './editorStore';

afterEach(cleanup);

describe('ViewToolbar', () => {
  it('"Zoom to fit" requests a camera refit (replaces auto-refit, #57)', async () => {
    const store = createEditorStore();
    render(<ViewToolbar useStore={store} />);
    await userEvent.setup().click(await screen.findByRole('button', { name: /zoom to fit/i }));
    expect(store.getState().fitTick).toBe(1);
  });
});

describe('One click toggles an orthographic top-down view', () => {
  it('a segmented 3D | 2D top-down control marks the current view with aria-pressed', async () => {
    const store = createEditorStore();
    render(<ViewToolbar useStore={store} />);
    const d3 = await screen.findByRole('button', { name: '3D' });
    const d2 = await screen.findByRole('button', { name: /2d top-down/i });
    expect(d3.getAttribute('aria-pressed')).toBe('true');
    expect(d2.getAttribute('aria-pressed')).toBe('false');
    const user = userEvent.setup();
    await user.click(d2);
    expect(store.getState().viewMode).toBe('2d');
    expect(d2.getAttribute('aria-pressed')).toBe('true');
    expect(d3.getAttribute('aria-pressed')).toBe('false');
    await user.click(d2); // the active segment doesn't flip back
    expect(store.getState().viewMode).toBe('2d');
    await user.click(d3);
    expect(store.getState().viewMode).toBe('3d');
  });
});

describe('A count of issues shows in the toolbar', () => {
  it('shows the number of overlapping pairs and updates with clearance', async () => {
    const store = createEditorStore();
    render(<ViewToolbar useStore={store} />);
    expect(screen.getByText(/no layout issues/i)).toBeTruthy();
    const a = store.getState().placeEquipment('base-workstation', { x: 5, y: 5 });
    const b = store.getState().placeEquipment('base-workstation', { x: 5.5, y: 5 });
    expect(a && b).toBeTruthy();
    expect(await screen.findByText(/1 layout issue\b/i)).toBeTruthy();
  });

  it('a clearance setting flags items that are too close', async () => {
    const store = createEditorStore();
    render(<ViewToolbar useStore={store} />);
    const t = BASE_EQUIPMENT_TYPES.find((x) => x.id === 'base-workstation')!;
    const at = (id: string, x: number) => instantiate(t, { id, name: id, position: { x, y: 5 } });
    store.setState({ equipment: [at('a', 5), at('b', 5 + t.footprint.width + 0.5)] });
    expect(await screen.findByText(/no layout issues/i)).toBeTruthy();
    store.getState().setClearance(1);
    expect(await screen.findByText(/1 layout issue\b/i)).toBeTruthy();
    store.getState().setClearance(null);
    expect(await screen.findByText(/no layout issues/i)).toBeTruthy();
  });
});

describe('Clearance input keeps typed text', () => {
  it('typing "0.5" stores metres, converts from the display unit, and updates the count', async () => {
    const store = createEditorStore();
    store.getState().setUnit('m');
    const t = BASE_EQUIPMENT_TYPES.find((x) => x.id === 'base-workstation')!;
    const at = (id: string, x: number) => instantiate(t, { id, name: id, position: { x, y: 5 } });
    store.setState({ equipment: [at('a', 5), at('b', 5 + t.footprint.width + 0.3)] });
    render(<ViewToolbar useStore={store} />);
    const input = screen.getByLabelText(/minimum clearance/i) as HTMLInputElement;
    await userEvent.setup().type(input, '0.5');
    expect(input.value).toBe('0.5');
    expect(store.getState().clearance).toBeCloseTo(0.5);
    expect(await screen.findByText(/1 layout issue\b/i)).toBeTruthy();
    await userEvent.setup().clear(input);
    expect(store.getState().clearance).toBeNull();
  });

  it('LE-6: typing a multi-character clearance is one undo step', async () => {
    const store = createEditorStore();
    store.getState().setUnit('m');
    render(<ViewToolbar useStore={store} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText(/minimum clearance/i), '0.75');
    await user.tab();
    expect(store.getState().clearance).toBeCloseTo(0.75);
    store.getState().undo();
    expect(store.getState().clearance).toBeNull();
    expect(store.getState().canUndo).toBe(false);
  });
});
