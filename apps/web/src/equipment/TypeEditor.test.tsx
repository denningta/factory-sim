import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { userEquipmentTypeSchema } from '@factory-sim/schema';
import { TypeEditor } from './TypeEditor';

afterEach(cleanup);

async function fill(label: RegExp, value: string) {
  const el = screen.getByLabelText(label);
  await userEvent.clear(el);
  await userEvent.type(el, value);
}

describe('TypeEditor', () => {
  it('AC1: I choose behavior, name, footprint, height, color and default parameters', async () => {
    const onSave = vi.fn();
    render(<TypeEditor unit="m" onSave={onSave} onCancel={() => {}} />);
    await userEvent.selectOptions(screen.getByLabelText(/base behavior/i), 'workstation');
    await fill(/^name/i, '5-axis CNC');
    await fill(/^width/i, '3');
    await fill(/^length/i, '2.5');
    await fill(/^height/i, '2.4');
    await fill(/^color/i, '#2f6f9f');
    await fill(/^capacity/i, '2');
    await userEvent.click(screen.getByRole('button', { name: /save type/i }));
    const saved = userEquipmentTypeSchema.parse(onSave.mock.calls[0]![0]);
    expect(saved).toMatchObject({
      name: '5-axis CNC',
      behavior: 'workstation',
      footprint: { width: 3, length: 2.5 },
      height: 2.4,
      color: '#2f6f9f',
      params: { capacity: 2, batchSize: 1 },
    });
  });

  it('AC1: conveyor types take a speed; the params follow the chosen behavior', async () => {
    const onSave = vi.fn();
    render(<TypeEditor unit="m" onSave={onSave} onCancel={() => {}} />);
    await userEvent.selectOptions(screen.getByLabelText(/base behavior/i), 'conveyor');
    expect(screen.queryByLabelText(/^capacity/i)).toBeNull();
    await fill(/^name/i, 'Belt');
    await fill(/^speed/i, '0.5');
    await userEvent.click(screen.getByRole('button', { name: /save type/i }));
    expect(onSave.mock.calls[0]![0]).toMatchObject({
      behavior: 'conveyor',
      params: { speed: 0.5 },
    });
  });

  it('AC1: dimensions are typed in the display unit and saved in meters', async () => {
    const onSave = vi.fn();
    render(<TypeEditor unit="ft" onSave={onSave} onCancel={() => {}} />);
    await fill(/^name/i, 'Press');
    await fill(/^width/i, '10');
    await userEvent.click(screen.getByRole('button', { name: /save type/i }));
    expect(onSave.mock.calls[0]![0].footprint.width).toBeCloseTo(3.048, 6);
  });

  it('AC1: a blank name or invalid size is refused with a message', async () => {
    const onSave = vi.fn();
    render(<TypeEditor unit="m" onSave={onSave} onCancel={() => {}} />);
    await userEvent.click(screen.getByRole('button', { name: /save type/i }));
    expect(screen.getByRole('alert').textContent).toMatch(/name/i);
    await fill(/^name/i, 'X');
    await fill(/^height/i, '0');
    await userEvent.click(screen.getByRole('button', { name: /save type/i }));
    expect(screen.getByRole('alert').textContent).toMatch(/height/i);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('AC3: editing keeps the type id, so instances can find it', async () => {
    const onSave = vi.fn();
    const initial = userEquipmentTypeSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'CNC',
      behavior: 'buffer',
      params: { capacity: 4 },
      footprint: { width: 1, length: 1 },
      height: 1,
      color: '#112233',
      ports: [
        { id: 'in', kind: 'input', u: 0, v: -0.5 },
        { id: 'out', kind: 'output', u: 0, v: 0.5 },
      ],
    });
    render(<TypeEditor unit="m" initial={initial} onSave={onSave} onCancel={() => {}} />);
    await fill(/^name/i, 'CNC mk2');
    await userEvent.click(screen.getByRole('button', { name: /save type/i }));
    expect(onSave.mock.calls[0]![0]).toMatchObject({ id: initial.id, name: 'CNC mk2' });
  });

  it('AC3: the behavior of a saved type is locked, since placed instances depend on it', () => {
    const initial = userEquipmentTypeSchema.parse({
      id: '11111111-1111-4111-8111-111111111111',
      name: 'CNC',
      behavior: 'buffer',
      params: { capacity: 4 },
      footprint: { width: 1, length: 1 },
      height: 1,
      color: '#112233',
      ports: [
        { id: 'in', kind: 'input', u: 0, v: -0.5 },
        { id: 'out', kind: 'output', u: 0, v: 0.5 },
      ],
    });
    render(<TypeEditor unit="m" initial={initial} onSave={() => {}} onCancel={() => {}} />);
    expect((screen.getByLabelText(/base behavior/i) as HTMLSelectElement).disabled).toBe(true);
  });
});
