import { useEffect, type ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEditorStore } from '../layout/editorStore';
import { useLayersStore } from '../layout/layersStore';
import { useSessionStore } from './sessionStore';
import { SimulateScreen } from './SimulateScreen';

vi.mock('../layout/FloorScene', () => ({
  FloorScene: ({ children }: { children?: ReactNode }) => <div data-testid="scene">{children}</div>,
}));
vi.mock('./TechLayer', () => ({ TechLayer: () => <div /> }));
vi.mock('./StationLayer', () => ({ StationLayer: () => <div /> }));
vi.mock('../layout/ConnectionArcs', () => ({ ConnectionArcs: () => <div /> }));
vi.mock('./PartLayer', () => ({
  PartLayer: () => {
    useEffect(() => {}, []);
    return <div />;
  },
}));

afterEach(() => {
  cleanup();
  localStorage.clear();
  useLayersStore.setState({ connections: true });
});

describe('SF-3 AC4: Simulate has a Layers menu', () => {
  it('shows Layers in the View toolbar; toggling Connections turns the layer off', async () => {
    useSessionStore.setState({ count: 0, current: null });
    useEditorStore.setState(useEditorStore.getInitialState(), true);
    const s = useEditorStore.getState;
    const src = s().placeEquipment('base-source', { x: 0, y: 0 })!;
    const ws = s().placeEquipment('base-workstation', { x: 6, y: 0 })!;
    const sink = s().placeEquipment('base-sink', { x: 12, y: 0 })!;
    s().connect({ equipmentId: src.id, portId: 'out' }, { equipmentId: ws.id, portId: 'in' });
    s().connect({ equipmentId: ws.id, portId: 'out' }, { equipmentId: sink.id, portId: 'in' });
    const p = s().addProduct();
    s().addRoutingStep(p.id, ws.id);
    s().setCycleTime(p.id, ws.id, 5);
    s().setReleaseInterval(4);
    const t = s().addTechnician();
    s().setTechnicianStation(t.id, ws.id, true);
    render(<SimulateScreen />);
    const bar = screen.getByRole('toolbar', { name: 'View' });
    await userEvent.click(within(bar).getByRole('button', { name: 'Layers' }));
    await userEvent.click(screen.getByRole('menuitemcheckbox', { name: 'Connections' }));
    expect(useLayersStore.getState().connections).toBe(false);
  });
});
