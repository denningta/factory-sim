import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEditorStore } from '../layout/editorStore';
import { SimulateScreen } from './SimulateScreen';

vi.mock('../layout/FloorScene', () => ({
  FloorScene: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}));
vi.mock('./TechLayer', () => ({ TechLayer: () => <div /> }));
vi.mock('./PartLayer', () => ({ PartLayer: () => <div /> }));

let wsId: string;
beforeEach(() => {
  useEditorStore.setState(useEditorStore.getInitialState(), true);
  const s = useEditorStore.getState;
  const src = s().placeEquipment('base-source', { x: 0, y: 0 })!;
  const ws = s().placeEquipment('base-workstation', { x: 6, y: 0 })!;
  const sink = s().placeEquipment('base-sink', { x: 12, y: 0 })!;
  wsId = ws.id;
  s().connect({ equipmentId: src.id, portId: 'out' }, { equipmentId: ws.id, portId: 'in' });
  s().connect({ equipmentId: ws.id, portId: 'out' }, { equipmentId: sink.id, portId: 'in' });
  const p = s().addProduct();
  s().addRoutingStep(p.id, ws.id);
  s().setCycleTime(p.id, ws.id, 5);
  // No technician: the manual workstation is a blocking error.
});
afterEach(cleanup);

describe('SE-5 AC2: issues are listed; clicking one selects the object', () => {
  it('lists the issue and selects its equipment on click', async () => {
    const onNavigate = vi.fn();
    render(<SimulateScreen onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole('button', { name: /no technician/i }));
    expect(useEditorStore.getState().selectedIds).toEqual([wsId]);
    expect(onNavigate).toHaveBeenCalledWith('layout');
  });
});

describe('SE-5 AC1: a product with no routing blocks the run', () => {
  it('lists it', () => {
    useEditorStore.getState().addProduct(); // second product, empty routing
    render(<SimulateScreen />);
    expect(screen.getByText(/no routing/i)).toBeTruthy();
  });
});

describe('SE-5 AC3: a run cannot start while blocking errors remain', () => {
  it('shows no playback controls while an error remains, and does once it is fixed', async () => {
    render(<SimulateScreen />);
    expect(screen.queryByRole('toolbar', { name: 'Playback' })).toBeNull();
    cleanup();
    const t = useEditorStore.getState().addTechnician();
    useEditorStore.getState().setTechnicianStation(t.id, wsId, true);
    render(<SimulateScreen />);
    expect(screen.getByRole('toolbar', { name: 'Playback' })).toBeTruthy();
  });
});
