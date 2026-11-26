import { describe, expect, it } from 'vitest';
import { createEditorStore } from './editorStore';
import { portKey, portVisual, validInputKeys, type PortVisualInput } from './portMarkers';

const base: PortVisualInput = {
  kind: 'output',
  connected: false,
  hovered: false,
  pending: null,
  active: false,
  valid: false,
};

describe('SF-4 AC2: hover enlarges the port and shows a hint', () => {
  it('enlarges on hover and hints "Output: click to connect" / "Input"', () => {
    const rest = portVisual(base);
    const hot = portVisual({ ...base, hovered: true });
    expect(hot.scale).toBeGreaterThan(rest.scale);
    expect(hot.hint).toBe('Output: click to connect');
    expect(portVisual({ ...base, kind: 'input', hovered: true }).hint).toBe('Input');
    expect(rest.hint).toBeNull();
  });
});

describe('SF-4 AC1: labelled flat markers', () => {
  it('shows the IN / OUT label at rest', () => {
    expect(portVisual(base).showLabel).toBe(true);
  });
});

describe('SF-4 AC3: connect mode highlights valid inputs and dims the rest', () => {
  const pending = { equipmentId: 'a', portId: 'out' };
  const mode = { ...base, kind: 'input' as const, pending };
  it('valid inputs are brighter and larger than other ports', () => {
    const valid = portVisual({ ...mode, valid: true });
    const other = portVisual({ ...mode, valid: false });
    expect(valid.opacity).toBe(1);
    expect(other.opacity).toBeLessThan(portVisual(base).opacity);
    expect(valid.scale).toBeGreaterThan(other.scale);
  });

  it('validInputKeys: inputs of other equipment not already linked from the pending output', () => {
    const store = createEditorStore();
    const a = store.getState().placeEquipment('base-workstation', { x: 5, y: 5 })!.id;
    const b = store.getState().placeEquipment('base-workstation', { x: 10, y: 5 })!.id;
    const c = store.getState().placeEquipment('base-workstation', { x: 15, y: 5 })!.id;
    const out = { equipmentId: a, portId: 'out' };
    store.getState().connect(out, { equipmentId: b, portId: 'in' });
    const { equipment, connections } = store.getState();
    const keys = validInputKeys(equipment, connections, out);
    expect([...keys]).toEqual([portKey({ equipmentId: c, portId: 'in' })]);
    expect(validInputKeys(equipment, connections, null).size).toBe(0);
  });
});

describe('SF-4 AC4: connected ports shrink to a dim dot', () => {
  it('connected vs unconnected marker scale/opacity', () => {
    const free = portVisual(base);
    const linked = portVisual({ ...base, connected: true });
    expect(linked.scale).toBeLessThan(free.scale);
    expect(linked.opacity).toBeLessThan(free.opacity);
    expect(linked.showLabel).toBe(false);
  });

  it('returns to full size on hover and in connect mode', () => {
    const free = portVisual(base);
    expect(portVisual({ ...base, connected: true, hovered: true }).scale).toBeGreaterThanOrEqual(
      free.scale,
    );
    const mode = portVisual({
      ...base,
      kind: 'input',
      connected: true,
      valid: true,
      pending: { equipmentId: 'a', portId: 'out' },
    });
    expect(mode.scale).toBeGreaterThanOrEqual(free.scale);
    expect(mode.opacity).toBe(1);
  });
});
