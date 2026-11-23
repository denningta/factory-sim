import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PropertiesPanel } from './PropertiesPanel';
import { createEditorStore } from './editorStore';

let store: ReturnType<typeof createEditorStore>;
beforeEach(() => {
  localStorage.clear();
  store = createEditorStore();
  store.getState().setUnit('m');
  render(<PropertiesPanel useStore={store} />);
});
afterEach(cleanup);

const place = (x: number, y: number) => {
  const e = store.getState().placeEquipment('base-workstation', { x, y })!;
  store.getState().selectEquipment(e.id, true);
  return e;
};

describe('PropertiesPanel', () => {
  it('shows numeric params only; labor mode is not rendered as a field (schema v4)', async () => {
    place(2, 2);
    expect(await screen.findByLabelText(/capacity/i)).toBeTruthy();
    expect(screen.queryByLabelText(/labor/i)).toBeNull();
    expect(screen.queryByDisplayValue('[object Object]')).toBeNull();
  });

  it('prompts to select something when nothing is selected', async () => {
    expect(await screen.findByText(/select equipment/i)).toBeTruthy();
  });

  it('Position and rotation show in the properties panel', async () => {
    const e = place(4, 7);
    store.getState().setSelectedRotation(90);
    expect(((await screen.findByLabelText(/^name/i)) as HTMLInputElement).value).toBe(e.name);
    expect((screen.getByLabelText(/position x/i) as HTMLInputElement).value).toBe('4');
    expect((screen.getByLabelText(/position y/i) as HTMLInputElement).value).toBe('7');
    expect((screen.getByLabelText(/rotation/i) as HTMLInputElement).value).toBe('90');
  });

  it('shows position in the display unit (ft), stored as meters', async () => {
    store.getState().setUnit('ft');
    store.getState().toggleSnap(); // keep the exact typed position
    place(3.048, 0.3048 * 5);
    expect(((await screen.findByLabelText(/position x/i)) as HTMLInputElement).value).toBe('10');
    expect(store.getState().equipment[0]!.position.x).toBe(3.048);
  });

  it('I can rotate in 90° steps with buttons', async () => {
    const user = userEvent.setup();
    place(4, 4);
    await user.click(await screen.findByRole('button', { name: /rotate 90°/i }));
    expect(store.getState().equipment[0]!.rotation).toBeCloseTo(Math.PI / 2, 9);
    expect((screen.getByLabelText(/rotation/i) as HTMLInputElement).value).toBe('90');
  });

  it('I can type an angle', async () => {
    const user = userEvent.setup();
    place(4, 4);
    const field = await screen.findByLabelText(/rotation/i);
    await user.clear(field);
    await user.type(field, '45');
    expect(store.getState().equipment[0]!.rotation).toBeCloseTo(Math.PI / 4, 9);
  });

  it('with several selected it shows the count and a delete button removes them', async () => {
    const user = userEvent.setup();
    place(2, 2);
    place(6, 6);
    expect(await screen.findByText(/2 selected/i)).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /delete/i }));
    expect(store.getState().equipment).toHaveLength(0);
  });

  it('Selecting an object opens its name, type, dimensions and simulation parameters', async () => {
    const e = place(4, 4);
    expect(((await screen.findByLabelText(/^name/i)) as HTMLInputElement).value).toBe(e.name);
    expect(screen.getByText('Workstation', { selector: '[data-testid="type"]' })).toBeTruthy();
    expect((screen.getByLabelText(/^width/i) as HTMLInputElement).value).toBe('2');
    expect((screen.getByLabelText(/capacity/i) as HTMLInputElement).value).toBe('1');
    expect((screen.getByLabelText(/batch size/i) as HTMLInputElement).value).toBe('1');
  });

  it('shows a conveyor speed field for conveyors', async () => {
    const e = store.getState().placeEquipment('base-conveyor', { x: 5, y: 5 })!;
    store.getState().selectEquipment(e.id, false);
    expect(((await screen.findByLabelText(/speed/i)) as HTMLInputElement).value).toBe('0.2');
  });

  it('edits in the panel update the stored equipment (and so the 3D view) immediately', async () => {
    const user = userEvent.setup();
    place(4, 4);
    const name = await screen.findByLabelText(/^name/i);
    await user.clear(name);
    await user.type(name, 'Weld');
    expect(store.getState().equipment[0]!.name).toBe('Weld');
    const x = screen.getByLabelText(/position x/i);
    await user.clear(x);
    await user.type(x, '9');
    expect(store.getState().equipment[0]!.position.x).toBe(9);
    const cap = screen.getByLabelText(/capacity/i);
    await user.clear(cap);
    await user.type(cap, '4');
    expect(store.getState().equipment[0]!.params).toMatchObject({ capacity: 4 });
  });

  it('rejects an invalid value inline with a reason and does not store it', async () => {
    const user = userEvent.setup();
    place(4, 4);
    const batch = await screen.findByLabelText(/batch size/i);
    await user.clear(batch);
    await user.type(batch, '5');
    expect((await screen.findByRole('alert')).textContent).toMatch(/batch size cannot exceed/i);
    expect(store.getState().equipment[0]!.params).toMatchObject({ batchSize: 1 });
    expect(batch.getAttribute('aria-invalid')).toBe('true');
  });

  it('rejects non-numeric text and clears the error once the value is valid', async () => {
    const user = userEvent.setup();
    place(4, 4);
    const cap = await screen.findByLabelText(/capacity/i);
    await user.clear(cap);
    expect((await screen.findByRole('alert')).textContent).toMatch(/enter a number/i);
    await user.type(cap, '2');
    expect(screen.queryByRole('alert')).toBeNull();
    expect(store.getState().equipment[0]!.params).toMatchObject({ capacity: 2 });
  });

  it('states the floor limit in the display unit (ft)', async () => {
    const user = userEvent.setup();
    store.getState().setUnit('ft');
    place(4, 4);
    const x = await screen.findByLabelText(/position x/i);
    await user.clear(x);
    await user.type(x, '999');
    const msg = (await screen.findByRole('alert')).textContent ?? '';
    expect(msg).toMatch(/98\.43 ft/);
    expect(msg).not.toMatch(/30 m/);
  });

  it('flags Batch size too when lowering Capacity breaks the rule', async () => {
    const user = userEvent.setup();
    place(4, 4);
    const cap = await screen.findByLabelText(/capacity/i);
    const batch = screen.getByLabelText(/batch size/i);
    await user.clear(cap);
    await user.type(cap, '3');
    await user.clear(batch);
    await user.type(batch, '3');
    await user.clear(cap);
    await user.type(cap, '1');
    expect(screen.getAllByRole('alert')).toHaveLength(2);
    expect(cap.getAttribute('aria-invalid')).toBe('true');
    expect(batch.getAttribute('aria-invalid')).toBe('true');
    expect(store.getState().equipment[0]!.params).toMatchObject({ capacity: 3, batchSize: 3 });
  });

  it('reverts an invalid field to the stored value on blur and clears its error', async () => {
    const user = userEvent.setup();
    place(4, 4);
    const batch = (await screen.findByLabelText(/batch size/i)) as HTMLInputElement;
    await user.clear(batch);
    await user.type(batch, '5');
    expect(await screen.findByRole('alert')).toBeTruthy();
    await user.tab();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(batch.value).toBe('1');
    expect(batch.getAttribute('aria-invalid')).toBeNull();
  });

  it('clears the linked Batch size error when Capacity loses focus', async () => {
    const user = userEvent.setup();
    place(4, 4);
    const cap = await screen.findByLabelText(/capacity/i);
    const batch = screen.getByLabelText(/batch size/i);
    await user.clear(cap);
    await user.type(cap, '3');
    await user.clear(batch);
    await user.type(batch, '3');
    await user.clear(cap);
    await user.type(cap, '1');
    await user.tab();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  describe('EQ-2: footprint and height', () => {
    const num = (re: RegExp) => screen.getByLabelText(re) as HTMLInputElement;

    it('Length, width and height are editable in the current units (m)', async () => {
      const user = userEvent.setup();
      place(4, 4);
      expect(((await screen.findByLabelText(/^width/i)) as HTMLInputElement).value).toBe('2');
      expect(num(/^length/i).value).toBe('1.5');
      expect(num(/^height/i).value).toBe('1.2');
      for (const [re, text] of [
        [/^width/i, '3'],
        [/^length/i, '2.5'],
        [/^height/i, '1.8'],
      ] as const) {
        await user.clear(num(re));
        await user.type(num(re), text);
      }
      const e = store.getState().equipment[0]!;
      expect(e.footprint).toEqual({ width: 3, length: 2.5 });
      expect(e.height).toBe(1.8);
    });

    it('edits in ft are stored as meters', async () => {
      const user = userEvent.setup();
      store.getState().setUnit('ft');
      place(4, 4);
      await user.clear(await screen.findByLabelText(/^width \(ft\)/i));
      await user.type(num(/^width/i), '10');
      expect(store.getState().equipment[0]!.footprint.width).toBeCloseTo(3.048, 9);
    });

    it('rejects zero or negative sizes inline and does not store them', async () => {
      const user = userEvent.setup();
      place(4, 4);
      const w = await screen.findByLabelText(/^width/i);
      await user.clear(w);
      await user.type(w, '0');
      expect(await screen.findByRole('alert')).toBeTruthy();
      expect(store.getState().equipment[0]!.footprint.width).toBe(2);
    });

    it('conveyor speed shows in ft/min in ft mode, stored as m/s', async () => {
      const user = userEvent.setup();
      store.getState().setUnit('ft');
      const e = store.getState().placeEquipment('base-conveyor', { x: 5, y: 5 })!;
      store.getState().selectEquipment(e.id, false);
      const f = (await screen.findByLabelText(/speed \(ft\/min\)/i)) as HTMLInputElement;
      expect(f.value).toBe('39.37');
      await user.clear(f);
      await user.type(f, '60');
      expect((store.getState().equipment[0]!.params as { speed: number }).speed).toBeCloseTo(
        0.3048,
        9,
      );
    });

    it('mixed rotations show as mixed', async () => {
      place(2, 2);
      place(6, 6);
      store.getState().rotateSelected(0);
      const first = store.getState().equipment[0]!;
      store.getState().selectEquipment(first.id, false);
      store.getState().rotateSelected(90);
      store.getState().selectEquipment(store.getState().equipment[1]!.id, true);
      expect(((await screen.findByLabelText(/rotation/i)) as HTMLInputElement).placeholder).toBe(
        'Mixed',
      );
      expect((screen.getByLabelText(/rotation/i) as HTMLInputElement).value).toBe('');
    });
  });
});

describe('FL-2 connection capacity', () => {
  const connect = () => {
    const a = store.getState().placeEquipment('base-workstation', { x: 5, y: 5 })!.id;
    const b = store.getState().placeEquipment('base-workstation', { x: 10, y: 5 })!.id;
    store.getState().connect({ equipmentId: a, portId: 'out' }, { equipmentId: b, portId: 'in' });
    return store.getState().connections[0]!.id;
  };

  it('a selected connection offers No buffer, Finite and Unlimited; the buffer form has no Unlimited', async () => {
    connect();
    expect(await screen.findByRole('radio', { name: /no buffer/i })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /finite/i })).toBeTruthy();
    expect(screen.getByRole('radio', { name: /unlimited/i })).toBeTruthy();
    const buf = store.getState().placeEquipment('base-buffer', { x: 20, y: 20 })!;
    store.getState().selectEquipment(buf.id, true);
    expect(await screen.findByLabelText(/capacity/i)).toBeTruthy();
    expect(screen.queryByRole('radio', { name: /unlimited/i })).toBeNull();
  });

  it('I can set each mode and the store follows', async () => {
    const user = userEvent.setup();
    connect();
    const cap = () => store.getState().connections[0]!.capacity;
    await user.click(await screen.findByRole('radio', { name: /unlimited/i }));
    expect(cap()).toBeNull();
    await user.click(screen.getByRole('radio', { name: /finite/i }));
    const size = screen.getByLabelText(/buffer size/i);
    await user.clear(size);
    await user.type(size, '4');
    expect(cap()).toBe(4);
    await user.click(screen.getByRole('radio', { name: /no buffer/i }));
    expect(cap()).toBe(0);
  });

  it('shows an inline error for a bad finite size and does not write it', async () => {
    const user = userEvent.setup();
    connect();
    await user.click(await screen.findByRole('radio', { name: /finite/i }));
    const size = screen.getByLabelText(/buffer size/i);
    await user.clear(size);
    await user.type(size, '1.5');
    expect((await screen.findByRole('alert')).textContent).toBeTruthy();
    expect(store.getState().connections[0]!.capacity).toBe(1);
  });
});

describe('FL-4 connection transfer time', () => {
  const connect = () => {
    const a = store.getState().placeEquipment('base-workstation', { x: 5, y: 5 })!.id;
    const b = store.getState().placeEquipment('base-workstation', { x: 10, y: 5 })!.id;
    store.getState().connect({ equipmentId: a, portId: 'out' }, { equipmentId: b, portId: 'in' });
  };
  const transfer = () => store.getState().connections[0]!.transfer;

  it('Transfer time can be fixed, or calculated from distance and speed', async () => {
    const user = userEvent.setup();
    connect();
    await user.click(await screen.findByRole('radio', { name: /fixed time/i }));
    const time = screen.getByLabelText(/transfer time \(s\)/i);
    await user.clear(time);
    await user.type(time, '6');
    await user.tab(); // the duration editor commits on blur or Enter
    expect(transfer()).toEqual({ kind: 'fixed', time: { kind: 'fixed', value: 6 } });
    await user.click(screen.getByRole('radio', { name: /distance and speed/i }));
    const speed = screen.getByLabelText(/speed \(m\/s\)/i);
    await user.clear(speed);
    await user.type(speed, '0.5');
    expect(transfer()).toEqual({ kind: 'speed', speed: 0.5 });
    // The calculated time is shown so the engineer sees what the speed means.
    expect(screen.getByText(/^distance/i).textContent).toMatch(/s\b/);
    await user.click(screen.getByRole('radio', { name: /instant/i }));
    expect(transfer()).toEqual({ kind: 'instant' });
  });

  it('in ft mode the speed is entered in ft/min and stored in m/s', async () => {
    const user = userEvent.setup();
    store.getState().setUnit('ft');
    connect();
    await user.click(await screen.findByRole('radio', { name: /distance and speed/i }));
    const speed = screen.getByLabelText(/speed \(ft\/min\)/i);
    await user.clear(speed);
    await user.type(speed, '100');
    expect((transfer() as { speed: number }).speed).toBeCloseTo(0.508, 3);
  });

  it('a non-fixed transfer time stays visible and editable', async () => {
    connect();
    store.getState().updateConnection(store.getState().connections[0]!.id, {
      transfer: { kind: 'fixed', time: { kind: 'normal', mean: 5, stdDev: 1 } },
    });
    expect(await screen.findByDisplayValue('5')).toBeTruthy();
  });

  it('shows an inline error for a bad speed and does not write it', async () => {
    const user = userEvent.setup();
    connect();
    await user.click(await screen.findByRole('radio', { name: /distance and speed/i }));
    const speed = screen.getByLabelText(/speed \(m\/s\)/i);
    await user.clear(speed);
    await user.type(speed, '0');
    expect((await screen.findByRole('alert')).textContent).toBeTruthy();
    expect(transfer().kind).toBe('speed');
    expect((transfer() as { speed: number }).speed).toBeGreaterThan(0);
  });
});
