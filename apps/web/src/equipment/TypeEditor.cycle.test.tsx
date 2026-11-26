import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { userEquipmentTypeSchema, type EquipmentType } from '@factory-sim/schema';
import { TypeEditor } from './TypeEditor';

vi.mock('./EquipmentModel', () => ({ ModelPreview: () => <div /> }));
afterEach(cleanup);

/** SF-7 AC3: the type editor edits cure time, batch size and max wait. */
const autoclave: EquipmentType = userEquipmentTypeSchema.parse({
  id: '6f1c2d3e-4a5b-4c6d-8e7f-0a1b2c3d4e5f',
  name: 'My autoclave',
  behavior: 'workstation',
  model: 'asc-autoclave',
  params: {
    capacity: 4,
    batchSize: 4,
    labor: {
      mode: 'automatic',
      loadTime: { kind: 'fixed', value: 300 },
      unloadTime: { kind: 'fixed', value: 300 },
    },
    cycle: { mode: 'perBatch', time: { kind: 'fixed', value: 7200 } },
    maxWait: 900,
  },
  footprint: { width: 2.4, length: 5 },
  height: 2.6,
  color: '#7d8794',
  ports: [
    { id: 'in', kind: 'input', u: 0, v: -0.5 },
    { id: 'out', kind: 'output', u: 0, v: 0.5 },
  ],
});

async function fill(label: RegExp, value: string) {
  const el = screen.getByLabelText(label);
  await userEvent.clear(el);
  if (value) await userEvent.type(el, value);
}
async function save(initial: EquipmentType = autoclave) {
  const onSave = vi.fn();
  render(<TypeEditor unit="ft" initial={initial} onSave={onSave} onCancel={() => {}} />);
  return onSave;
}
const clickSave = () => userEvent.click(screen.getByRole('button', { name: /save type/i }));
const saved = (f: ReturnType<typeof vi.fn>) =>
  (f.mock.calls[0]![0] as EquipmentType).params as Record<string, unknown>;

describe('SF-7 AC3: TypeEditor cure time, batch size and max wait', () => {
  it('cure time shows in minutes and saves in seconds', async () => {
    const onSave = await save();
    expect((screen.getByLabelText(/cure time \(min\)/i) as HTMLInputElement).value).toBe('120');
    await fill(/cure time/i, '90');
    await clickSave();
    expect(saved(onSave).cycle).toEqual({ mode: 'perBatch', time: { kind: 'fixed', value: 5400 } });
  });

  it('cure time must be greater than 0', async () => {
    const onSave = await save();
    await fill(/cure time/i, '0');
    await clickSave();
    expect((await screen.findByRole('alert')).textContent).toMatch(/cure time/i);
    expect(onSave).not.toHaveBeenCalled();
  });

  it('batch size saves, and may not exceed the capacity', async () => {
    const onSave = await save();
    await fill(/^batch size/i, '2');
    await clickSave();
    expect(saved(onSave).batchSize).toBe(2);
    cleanup();
    const again = await save();
    await fill(/^batch size/i, '5');
    await clickSave();
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(again).not.toHaveBeenCalled();
  });

  it('max wait shows in minutes and saves in seconds; blank means wait for a full batch', async () => {
    const onSave = await save();
    expect((screen.getByLabelText(/max wait \(min\)/i) as HTMLInputElement).value).toBe('15');
    await fill(/max wait/i, '10');
    await clickSave();
    expect(saved(onSave).maxWait).toBe(600);
    cleanup();
    const blank = await save();
    await fill(/max wait/i, '');
    await clickSave();
    expect('maxWait' in saved(blank)).toBe(false);
  });

  it('switching the cycle mode hides or shows the cure time', async () => {
    const onSave = await save();
    const mode = screen.getByLabelText(/^cycle$/i);
    await userEvent.selectOptions(mode, 'perProduct');
    expect(screen.queryByLabelText(/cure time/i)).toBeNull();
    await userEvent.selectOptions(mode, 'perBatch');
    expect(screen.getByLabelText(/cure time \(min\)/i)).toBeTruthy();
    await userEvent.selectOptions(mode, 'perProduct');
    await clickSave();
    expect(saved(onSave).cycle).toBeUndefined();
  });

  it('a new type starts per product, with no cure time shown', () => {
    render(<TypeEditor unit="m" onSave={() => {}} onCancel={() => {}} />);
    expect((screen.getByLabelText(/^cycle$/i) as HTMLSelectElement).value).toBe('perProduct');
    expect(screen.queryByLabelText(/cure time/i)).toBeNull();
  });

  it('keeps the labor settings when saving', async () => {
    const onSave = await save();
    await clickSave();
    expect(saved(onSave).labor).toMatchObject({ mode: 'automatic' });
  });
});
