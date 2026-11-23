import { beforeEach, describe, expect, it } from 'vitest';
import { createProject, validateProject } from '@factory-sim/schema';
import { createEditorStore } from '../layout/editorStore';
import { preRunIssues } from './preRunIssues';

let store: ReturnType<typeof createEditorStore>;
beforeEach(() => {
  localStorage.clear();
  store = createEditorStore();
});

describe('PR-1 products: create, edit and delete', () => {
  it('creates products with a part number, name and display color', () => {
    const a = store.getState().addProduct();
    const b = store.getState().addProduct();
    expect(a.partNumber).not.toBe(b.partNumber);
    expect(a.id).not.toBe(b.id);
    expect(a.color).toMatch(/^#[0-9a-f]{6}$/i);
    expect(store.getState().products).toHaveLength(2);
  });

  it('edits part number, name and color', () => {
    const a = store.getState().addProduct();
    const r = store
      .getState()
      .updateProduct(a.id, { partNumber: 'A-100', name: 'Gearbox', color: '#112233' });
    expect(r).toEqual({ ok: true });
    expect(store.getState().products[0]).toMatchObject({
      partNumber: 'A-100',
      name: 'Gearbox',
      color: '#112233',
    });
  });

  it('rejects a blank name, blank part number or bad color and changes nothing', () => {
    const a = store.getState().addProduct();
    for (const patch of [{ name: ' ' }, { partNumber: '  ' }, { color: 'red' }]) {
      expect(store.getState().updateProduct(a.id, patch).ok).toBe(false);
    }
    expect(store.getState().products[0]).toEqual(a);
  });

  it('deletes a product', () => {
    const a = store.getState().addProduct();
    const b = store.getState().addProduct();
    store.getState().deleteProduct(a.id);
    expect(store.getState().products.map((p) => p.id)).toEqual([b.id]);
  });

  it('an undo restores a deleted product', () => {
    const a = store.getState().addProduct();
    store.getState().deleteProduct(a.id);
    store.getState().undo();
    expect(store.getState().products).toEqual([a]);
  });

  it('loadDocument loads the document products', () => {
    const a = store.getState().addProduct();
    const other = createEditorStore();
    other.getState().loadDocument({ ...createProject(), products: [a] });
    expect(other.getState().products).toEqual([a]);
  });
});

describe('PR-1 part numbers must be unique', () => {
  it('rejects a duplicate part number, ignoring surrounding space', () => {
    const a = store.getState().addProduct();
    const b = store.getState().addProduct();
    store.getState().updateProduct(a.id, { partNumber: 'A-100' });
    const r = store.getState().updateProduct(b.id, { partNumber: ' A-100 ' });
    expect(r).toMatchObject({ ok: false, field: 'partNumber' });
    expect(store.getState().products[1]!.partNumber).toBe(b.partNumber);
  });

  it('matches the schema exactly: part numbers differing only by case are distinct', () => {
    const a = store.getState().addProduct();
    const b = store.getState().addProduct();
    store.getState().updateProduct(a.id, { partNumber: 'A-100' });
    expect(store.getState().updateProduct(b.id, { partNumber: 'a-100' }).ok).toBe(true);
    const doc = { ...createProject(), products: store.getState().products };
    expect(validateProject(doc).ok).toBe(true);
  });

  it('keeping a product’s own part number is not a duplicate', () => {
    const a = store.getState().addProduct();
    expect(store.getState().updateProduct(a.id, { partNumber: a.partNumber, name: 'X' }).ok).toBe(
      true,
    );
  });

  it('default part numbers stay unique after deletions', () => {
    const a = store.getState().addProduct();
    store.getState().addProduct();
    store.getState().deleteProduct(a.id);
    store.getState().addProduct();
    const parts = store.getState().products.map((p) => p.partNumber);
    expect(new Set(parts).size).toBe(parts.length);
  });
});

describe('PR-1 a run needs at least one product', () => {
  it('reports no_products when there are none', () => {
    expect(preRunIssues({ products: [], cycleTimes: [], equipment: [], technicians: [] })).toEqual([
      { code: 'no_products', message: expect.stringMatching(/at least one product/i) },
    ]);
  });

  it('reports nothing once a product exists', () => {
    const a = createEditorStore().getState().addProduct();
    expect(preRunIssues({ products: [a], cycleTimes: [], equipment: [], technicians: [] })).toEqual(
      [],
    );
  });
});
