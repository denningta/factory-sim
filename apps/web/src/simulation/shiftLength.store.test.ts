import { beforeEach, describe, expect, it } from 'vitest';
import { createEditorStore } from '../layout/editorStore';

let store: ReturnType<typeof createEditorStore>;
const s = () => store.getState();
beforeEach(() => {
  store = createEditorStore();
});

describe('SE-4: shift length', () => {
  it('defaults to 8 h and can be set in seconds', () => {
    expect(s().shiftLength).toBe(8 * 3600);
    s().setShiftLength(4 * 3600);
    expect(s().shiftLength).toBe(4 * 3600);
  });

  it('ignores zero, negative and non-finite values', () => {
    s().setShiftLength(0);
    s().setShiftLength(-5);
    s().setShiftLength(Infinity);
    expect(s().shiftLength).toBe(8 * 3600);
  });

  it('changing it changes the per-shift release interval (shift length ÷ units)', () => {
    const p = s().addProduct();
    s().setDemandBasis('perShift');
    s().setDemandValue(p.id, 60);
    expect(s().release.interval).toEqual({ kind: 'fixed', value: 8 * 60 });
    s().setShiftLength(3600);
    expect(s().release.interval).toEqual({ kind: 'fixed', value: 60 });
  });
});
