import { beforeEach, describe, expect, it } from 'vitest';
import { createEditorStore } from './editorStore';

let store: ReturnType<typeof createEditorStore>;
const s = () => store.getState();
const val = (i: number) => s().demand.items.find((x) => x.productId === s().products[i]!.id)?.value;
beforeEach(() => {
  localStorage.clear();
  store = createEditorStore();
  for (let i = 0; i < 4; i++) s().addProduct();
});

describe('PR-5 demand mix polish', () => {
  it('AC1: undo restores which products are pinned', () => {
    const [a, b, c] = s().products;
    s().setDemandValue(a!.id, 40); // pins A; B, C, D share 60
    s().setDemandValue(b!.id, 10); // pins B; C, D share 50
    s().undo(); // B no longer pinned: A=40, others 20 each
    s().setDemandValue(c!.id, 50); // fits only if B is open: A stays 40, B and D share 10
    expect(val(0)).toBe(40);
    expect(val(1)).toBe(5);
    expect(val(2)).toBe(50);
    expect(val(3)).toBe(5);
  });

  it('AC1: redo restores the pins too', () => {
    const [a, b] = s().products;
    s().setDemandValue(a!.id, 40);
    s().undo();
    s().redo();
    s().setDemandValue(b!.id, 10); // A stays pinned at 40
    expect(val(0)).toBe(40);
  });

  it('AC2: flags when an edit rescales every other product', () => {
    const [a, b, c, d] = s().products;
    s().setDemandValue(a!.id, 10);
    s().setDemandValue(b!.id, 10);
    s().setDemandValue(c!.id, 10);
    expect(s().demandRescaled).toBe(false);
    s().setDemandValue(d!.id, 10); // everyone else already pinned
    expect(s().demandRescaled).toBe(true);
    s().setDemandValue(a!.id, 20);
    expect(s().demandRescaled).toBe(true);
  });

  it('AC3: float error in the pinned sum does not block a valid entry', () => {
    const [a, b, c] = s().products;
    s().setDemandValue(a!.id, 0.1);
    s().setDemandValue(b!.id, 0.2); // 0.1 + 0.2 = 0.30000000000000004
    s().setDemandValue(c!.id, 99.7); // exactly fits; D absorbs 0
    expect(val(0)).toBe(0.1);
    expect(val(1)).toBe(0.2);
    expect(val(3)).toBeCloseTo(0, 9);
    expect(s().demandRescaled).toBe(false);
  });
});
