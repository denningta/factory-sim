import { beforeEach, describe, expect, it } from 'vitest';
import { createProject, projectSchema } from '@factory-sim/schema';
import { createEditorStore } from '../layout/editorStore';

let store: ReturnType<typeof createEditorStore>;
const s = () => store.getState();
const valid = () =>
  projectSchema.safeParse({
    ...createProject(),
    floor: s().floor,
    equipment: s().equipment,
    products: s().products,
    connections: s().connections,
    cycleTimes: s().cycleTimes,
    technicians: s().technicians,
    demand: s().demand,
    release: s().release,
  }).success;
const value = (id: string) => s().demand.items.find((i) => i.productId === id)?.value;

beforeEach(() => {
  localStorage.clear();
  store = createEditorStore();
  s().addProduct();
  s().addProduct();
});

describe('PR-4 AC1: demand per product as units per shift or % of mix', () => {
  it('sets a product % of mix; the other product takes the rest so the total stays 100', () => {
    const [a, b] = s().products;
    expect(s().setDemandValue(a!.id, 70)).toEqual({ ok: true });
    expect(value(a!.id)).toBe(70);
    expect(value(b!.id)).toBe(30);
    expect(valid()).toBe(true);
  });

  it('rejects a % outside 0–100 and leaves demand unchanged', () => {
    const [a] = s().products;
    const before = s().demand;
    expect(s().setDemandValue(a!.id, 120).ok).toBe(false);
    expect(s().setDemandValue(a!.id, -1).ok).toBe(false);
    expect(s().demand).toBe(before);
  });

  it('switches to units per shift keeping each product its own value', () => {
    const [a, b] = s().products;
    s().setDemandValue(a!.id, 70);
    s().setDemandBasis('perShift');
    expect(s().demand.basis).toBe('perShift');
    s().setDemandValue(a!.id, 40);
    s().setDemandValue(b!.id, 10);
    expect(value(a!.id)).toBe(40);
    expect(value(b!.id)).toBe(10);
    expect(valid()).toBe(true);
  });

  it('turns per-shift demand into a fixed release interval from the shift length', () => {
    const [a, b] = s().products;
    s().setDemandBasis('perShift');
    s().setDemandValue(a!.id, 40);
    s().setDemandValue(b!.id, 20);
    expect(s().release.interval).toEqual({ kind: 'fixed', value: s().shiftLength / 60 });
  });

  it('is one undo step per edit', () => {
    const [a] = s().products;
    s().setDemandValue(a!.id, 70);
    s().undo();
    expect(s().demand.items).toEqual([]);
  });
});

describe('PR-4 AC2: release rule options', () => {
  it('fixed interval: smooth product order with a fixed interval in seconds', () => {
    s().setReleaseMode('random');
    s().setReleaseMode('fixed');
    expect(s().setReleaseInterval(45)).toEqual({ ok: true });
    expect(s().release).toEqual({
      interval: { kind: 'fixed', value: 45 },
      product: { kind: 'smooth' },
    });
    expect(s().setReleaseInterval(0).ok).toBe(false);
  });

  it('random by mix', () => {
    s().setReleaseMode('random');
    expect(s().release.product).toEqual({ kind: 'random' });
    expect(valid()).toBe(true);
  });

  it('repeating sequence starts as the products in order and accepts a pattern', () => {
    const [a, b] = s().products;
    s().setReleaseMode('sequence');
    expect(s().release.product).toEqual({ kind: 'sequence', pattern: [a!.id, b!.id] });
    expect(s().setReleasePattern([a!.id, a!.id, b!.id])).toEqual({ ok: true });
    expect(s().release.product).toEqual({ kind: 'sequence', pattern: [a!.id, a!.id, b!.id] });
    expect(valid()).toBe(true);
  });

  it('rejects an empty pattern or an unknown product', () => {
    s().setReleaseMode('sequence');
    expect(s().setReleasePattern([]).ok).toBe(false);
    expect(s().setReleasePattern(['nope']).ok).toBe(false);
  });

  it('deleting a product drops it from demand and the pattern, keeping the document valid', () => {
    const [a, b] = s().products;
    s().setDemandValue(a!.id, 70);
    s().setReleaseMode('sequence');
    s().setReleasePattern([a!.id, b!.id, a!.id]);
    s().deleteProduct(a!.id);
    expect(s().demand.items.map((i) => i.productId)).toEqual([b!.id]);
    expect(value(b!.id)).toBe(100);
    expect(s().release.product).toEqual({ kind: 'sequence', pattern: [b!.id] });
    expect(valid()).toBe(true);
    s().undo();
    expect(s().demand.items).toHaveLength(2);
  });

  it('falls back to a fixed interval when the pattern empties', () => {
    const [a] = s().products;
    s().setReleaseMode('sequence');
    s().setReleasePattern([a!.id]);
    s().deleteProduct(a!.id);
    expect(s().release.product).toEqual({ kind: 'smooth' });
  });

  it('loadDocument restores demand, release and shift length', () => {
    const doc = {
      ...createProject(),
      demand: { basis: 'perShift' as const, items: [{ productId: 'x', value: 5 }] },
      release: {
        interval: { kind: 'fixed' as const, value: 9 },
        product: { kind: 'random' as const },
      },
      calendar: { shiftLength: 3600 },
    };
    s().loadDocument(doc);
    expect(s().demand).toEqual(doc.demand);
    expect(s().release).toEqual(doc.release);
    expect(s().shiftLength).toBe(3600);
  });
});
