import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createEditorStore } from '../layout/editorStore';
import { ProductsPanel } from './ProductsPanel';

let store: ReturnType<typeof createEditorStore>;
const s = () => store.getState();
function setup() {
  const mk = (x: number, name: string) => {
    const e = s().placeEquipment('base-workstation', { x, y: 2 })!;
    s().updateEquipment(e.id, { name });
    return e.id;
  };
  const saw = mk(2, 'Saw');
  const cnc = mk(5, 'CNC');
  const p1 = s().addProduct();
  s().addRoutingStep(p1.id, saw);
  s().addRoutingStep(p1.id, cnc);
  return { saw, cnc, p1 };
}
beforeEach(() => {
  localStorage.clear();
  store = createEditorStore();
});
afterEach(cleanup);

const kind = (st: string) =>
  screen.getByLabelText(`Distribution, Product 1 at ${st}`) as HTMLSelectElement;
const param = (name: string, st: string) =>
  screen.getByLabelText(`${name}, Product 1 at ${st}`) as HTMLInputElement;

async function render_() {
  render(<ProductsPanel useStore={store} />);
  await screen.findByRole('table', { name: /cycle times/i });
}

describe('WS-2 supported: fixed, normal, triangular, lognormal, exponential', () => {
  it('offers exactly the five kinds', async () => {
    setup();
    await render_();
    expect([...kind('Saw').options].map((o) => o.value)).toEqual([
      'fixed',
      'normal',
      'triangular',
      'lognormal',
      'exponential',
    ]);
  });
});

describe('WS-2 each cycle-time cell can take any of these distributions', () => {
  it('stores a normal, a triangular, a lognormal and an exponential per cell', async () => {
    const user = userEvent.setup();
    const { saw, cnc, p1 } = setup();
    await render_();

    await user.selectOptions(kind('Saw'), 'normal');
    await user.type(param('Mean', 'Saw'), '60{Enter}');
    await user.type(param('Std dev', 'Saw'), '5{Enter}');
    expect(s().cycleTimes).toContainEqual({
      productId: p1.id,
      stationId: saw,
      time: { kind: 'normal', mean: 60, stdDev: 5 },
    });

    await user.selectOptions(kind('CNC'), 'triangular');
    await user.type(param('Min', 'CNC'), '10{Enter}');
    await user.type(param('Most likely', 'CNC'), '20{Enter}');
    await user.type(param('Max', 'CNC'), '50{Enter}');
    expect(s().cycleTimes).toContainEqual({
      productId: p1.id,
      stationId: cnc,
      time: { kind: 'triangular', min: 10, mode: 20, max: 50 },
    });

    await user.selectOptions(kind('Saw'), 'lognormal');
    await user.type(param('Mean', 'Saw'), '40{Enter}');
    await user.type(param('Std dev', 'Saw'), '8{Enter}');
    expect(s().cycleTimes).toContainEqual({
      productId: p1.id,
      stationId: saw,
      time: { kind: 'lognormal', mean: 40, stdDev: 8 },
    });

    await user.selectOptions(kind('Saw'), 'exponential');
    await user.type(param('Mean', 'Saw'), '25{Enter}');
    expect(s().cycleTimes).toContainEqual({
      productId: p1.id,
      stationId: saw,
      time: { kind: 'exponential', mean: 25 },
    });
  });

  it('shows a stored distribution’s parameters and switches back to fixed', async () => {
    const user = userEvent.setup();
    const { saw, p1 } = setup();
    s().setCycleTimeDuration(p1.id, saw, { kind: 'normal', mean: 60, stdDev: 5 });
    await render_();
    expect(kind('Saw').value).toBe('normal');
    expect(param('Mean', 'Saw').value).toBe('60');
    await user.selectOptions(kind('Saw'), 'fixed');
    await user.type(screen.getByLabelText('Cycle time, Product 1 at Saw'), '30{Enter}');
    expect(s().cycleTimes).toContainEqual({
      productId: p1.id,
      stationId: saw,
      time: { kind: 'fixed', value: 30 },
    });
  });

  it('rejects an invalid triangular (min above max) without touching the store', async () => {
    const user = userEvent.setup();
    const { saw, p1 } = setup();
    const r = s().setCycleTimeDuration(p1.id, saw, { kind: 'triangular', min: 9, mode: 5, max: 3 });
    expect(r.ok).toBe(false);
    expect(s().cycleTimes).toEqual([]);
    await render_();
    await user.selectOptions(kind('Saw'), 'triangular');
    expect(s().cycleTimes).toEqual([]);
  });
});

describe('WS-2 a small histogram previews the distribution', () => {
  it('shows a histogram for a non-fixed cell and updates when a parameter changes', async () => {
    const user = userEvent.setup();
    const { saw, p1 } = setup();
    s().setCycleTimeDuration(p1.id, saw, { kind: 'normal', mean: 60, stdDev: 5 });
    await render_();
    const before = screen.getByRole('img', {
      name: 'Distribution preview, Product 1 at Saw',
    }).innerHTML;
    expect(before).toContain('rect');
    await user.clear(param('Std dev', 'Saw'));
    await user.type(param('Std dev', 'Saw'), '15{Enter}');
    expect(
      screen.getByRole('img', { name: 'Distribution preview, Product 1 at Saw' }).innerHTML,
    ).not.toBe(before);
  });
});

describe('WS-2 negative samples are prevented (truncated)', () => {
  it('the store refuses non-positive or non-finite parameters', () => {
    const { saw, p1 } = setup();
    for (const bad of [
      { kind: 'normal', mean: -5, stdDev: 1 },
      { kind: 'exponential', mean: 0 },
      { kind: 'lognormal', mean: 10, stdDev: -1 },
    ] as const) {
      expect(s().setCycleTimeDuration(p1.id, saw, bad).ok).toBe(false);
    }
    expect(s().cycleTimes).toEqual([]);
  });
});
