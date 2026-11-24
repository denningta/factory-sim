import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { userEquipmentTypeSchema } from '@factory-sim/schema';
import { TypeEditor } from './TypeEditor';
import { useEditorStore } from '../layout/editorStore';
import { portWorldPosition } from '../layout/ports';

afterEach(cleanup);

async function saveNew(pick?: () => Promise<void>) {
  const onSave = vi.fn();
  render(<TypeEditor unit="m" onSave={onSave} onCancel={() => {}} />);
  await userEvent.type(screen.getByLabelText(/^name/i), 'Cell');
  await pick?.();
  await userEvent.click(screen.getByRole('button', { name: /save type/i }));
  return userEquipmentTypeSchema.parse(onSave.mock.calls[0]![0]);
}

describe('TypeEditor ports', () => {
  it('AC3: a new type has its input on one side and its output on the opposite side', async () => {
    const saved = await saveNew();
    expect(saved.ports).toEqual([
      { id: 'in', kind: 'input', u: 0, v: -0.5 },
      { id: 'out', kind: 'output', u: 0, v: 0.5 },
    ]);
    expect((screen.getByLabelText(/input.*side/i) as HTMLSelectElement).value).toBe('back');
    expect((screen.getByLabelText(/output.*side/i) as HTMLSelectElement).value).toBe('front');
  });

  it('AC1: I move the input and output to other footprint sides and offsets', async () => {
    const saved = await saveNew(async () => {
      await userEvent.selectOptions(screen.getByLabelText(/input.*side/i), 'left');
      await userEvent.selectOptions(screen.getByLabelText(/output.*side/i), 'right');
      const off = screen.getByLabelText(/output.*offset/i);
      await userEvent.clear(off);
      await userEvent.type(off, '25');
    });
    expect(saved.ports).toEqual([
      { id: 'in', kind: 'input', u: -0.5, v: 0 },
      { id: 'out', kind: 'output', u: 0.5, v: 0.25 },
    ]);
  });

  it('AC1: a source has only an output port to edit', () => {
    render(<TypeEditor unit="m" onSave={() => {}} onCancel={() => {}} />);
    return userEvent.selectOptions(screen.getByLabelText(/base behavior/i), 'source').then(() => {
      expect(screen.queryByLabelText(/input.*side/i)).toBeNull();
      expect(screen.getByLabelText(/output.*side/i)).toBeTruthy();
    });
  });

  it('AC1: editing a saved type shows and keeps its ports, ids included', async () => {
    const initial = userEquipmentTypeSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'CNC',
      behavior: 'workstation',
      params: { capacity: 1, batchSize: 1, labor: { mode: 'manual' } },
      footprint: { width: 1, length: 1 },
      height: 1,
      color: '#112233',
      ports: [
        { id: 'a', kind: 'input', u: -0.5, v: 0 },
        { id: 'b', kind: 'output', u: 0.5, v: 0 },
      ],
    });
    const onSave = vi.fn();
    render(<TypeEditor unit="m" initial={initial} onSave={onSave} onCancel={() => {}} />);
    expect((screen.getByLabelText(/input.*side/i) as HTMLSelectElement).value).toBe('left');
    await userEvent.selectOptions(screen.getByLabelText(/input.*side/i), 'back');
    await userEvent.click(screen.getByRole('button', { name: /save type/i }));
    expect(onSave.mock.calls[0]![0].ports).toEqual([
      { id: 'a', kind: 'input', u: 0, v: -0.5 },
      { id: 'b', kind: 'output', u: 0.5, v: 0 },
    ]);
  });

  it('AC2: a connection attaches to the edited port of a placed instance', async () => {
    const saved = await saveNew(async () => {
      await userEvent.selectOptions(screen.getByLabelText(/input.*side/i), 'left');
    });
    const s = useEditorStore.getState();
    s.setUserTypes([saved]);
    const a = s.placeEquipment(saved.id, { x: 5, y: 5 })!.id;
    const b = useEditorStore.getState().placeEquipment(saved.id, { x: 15, y: 5 })!.id;
    const r = useEditorStore
      .getState()
      .connect({ equipmentId: a, portId: 'out' }, { equipmentId: b, portId: 'in' });
    expect(r.ok).toBe(true);
    const inst = useEditorStore.getState().equipment.find((e) => e.id === b)!;
    const p = inst.ports.find((q) => q.id === 'in')!;
    expect(portWorldPosition(inst, p).x).toBeCloseTo(inst.position.x - 0.5 * inst.footprint.width);
  });
});

describe('TypeEditor ports: untouched rows', () => {
  it('keeps the original u/v of a port the user did not edit', async () => {
    const initial = userEquipmentTypeSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'CNC',
      behavior: 'workstation',
      params: { capacity: 1, batchSize: 1, labor: { mode: 'manual' } },
      footprint: { width: 1, length: 1 },
      height: 1,
      color: '#112233',
      ports: [
        { id: 'in', kind: 'input', u: 0.12345, v: -0.5 },
        { id: 'out', kind: 'output', u: 0, v: 0.5 },
      ],
    });
    const onSave = vi.fn();
    render(<TypeEditor unit="m" initial={initial} onSave={onSave} onCancel={() => {}} />);
    await userEvent.selectOptions(screen.getByLabelText(/output.*side/i), 'right');
    await userEvent.click(screen.getByRole('button', { name: /save type/i }));
    expect(onSave.mock.calls[0]![0].ports).toEqual([
      { id: 'in', kind: 'input', u: 0.12345, v: -0.5 },
      { id: 'out', kind: 'output', u: 0.5, v: 0 },
    ]);
  });
});
