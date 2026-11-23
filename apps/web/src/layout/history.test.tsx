import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createProject } from '@factory-sim/schema';
import { createEditorStore, HISTORY_LIMIT, useEditorStore } from './editorStore';
import { useEditorShortcuts, useUndoShortcuts } from './shortcuts';
import { PropertiesPanel } from './PropertiesPanel';
import { FloorPanel } from './FloorPanel';

let store: ReturnType<typeof createEditorStore>;
beforeEach(() => {
  localStorage.clear();
  store = createEditorStore();
  store.getState().setUnit('m');
});
afterEach(cleanup);

const place = (x = 4, y = 4) => store.getState().placeEquipment('base-workstation', { x, y })!;

describe('LE-3 undo and redo: covered edits', () => {
  it('undoes and redoes placing', () => {
    place();
    store.getState().undo();
    expect(store.getState().equipment).toEqual([]);
    store.getState().redo();
    expect(store.getState().equipment).toHaveLength(1);
  });

  it('undoes a move (one drag is one step)', () => {
    const e = place(4, 4);
    store.getState().selectEquipment(e.id, false);
    store.getState().dragSelected({ [e.id]: { x: 4, y: 4 } }, e.id, { x: 5, y: 3 });
    store.getState().undo();
    expect(store.getState().equipment[0]!.position).toEqual({ x: 4, y: 4 });
  });

  it('click-select with no movement adds no history entry', () => {
    const e = place(4, 4);
    store.getState().undo();
    store.getState().redo();
    store.getState().selectEquipment(e.id, false);
    store.getState().dragSelected({ [e.id]: { x: 4, y: 4 } }, e.id, { x: 0, y: 0 });
    store.getState().undo();
    expect(store.getState().equipment).toEqual([]); // the undo reverted the placing
  });

  it('view and camera state are not undoable', () => {
    place();
    store.getState().toggleView();
    store.getState().requestFit();
    const { viewMode, fitTick } = store.getState();
    store.getState().undo(); // reverts the placing only
    expect(store.getState().viewMode).toBe(viewMode);
    expect(store.getState().fitTick).toBe(fitTick);
    expect(store.getState().canUndo).toBe(false);
  });

  it('undoes rotating', () => {
    const e = place();
    store.getState().selectEquipment(e.id, false);
    store.getState().rotateSelected(90);
    store.getState().undo();
    expect(store.getState().equipment[0]!.rotation).toBe(0);
  });

  it('undoes property and dimension edits', () => {
    const e = place();
    store.getState().updateEquipment(e.id, { name: 'Mill', footprint: { width: 3 } });
    store.getState().undo();
    expect(store.getState().equipment[0]!.name).toBe(e.name);
    expect(store.getState().equipment[0]!.footprint).toEqual(e.footprint);
  });

  it('undoes deleting and restores the equipment', () => {
    const e = place();
    store.getState().selectEquipment(e.id, false);
    store.getState().deleteSelected();
    store.getState().undo();
    expect(store.getState().equipment).toEqual([e]);
  });

  it('undoes floor settings', () => {
    store.getState().setFloor({ width: 50 });
    store.getState().undo();
    expect(store.getState().floor.width).toBe(30);
  });

  it('a failed edit leaves no undo step', () => {
    const e = place();
    store.getState().undo();
    store.getState().redo();
    store.getState().updateEquipment(e.id, { name: '  ' });
    store.getState().undo();
    expect(store.getState().equipment).toEqual([]); // undid the placing, not a phantom edit
  });

  it('a new edit clears the redo stack', () => {
    place();
    store.getState().undo();
    place(8, 8);
    expect(store.getState().canRedo).toBe(false);
  });

  it('undo drops selected ids that no longer exist', () => {
    const e = place();
    store.getState().selectEquipment(e.id, false);
    store.getState().undo();
    expect(store.getState().selectedIds).toEqual([]);
  });
});

describe('LE-3 history depth', () => {
  it('keeps at least 50 steps of history', () => {
    expect(HISTORY_LIMIT).toBeGreaterThanOrEqual(50);
    for (let i = 0; i < 60; i++) place(1 + (i % 25), 1 + Math.floor(i / 25));
    for (let i = 0; i < 60; i++) store.getState().undo();
    expect(store.getState().equipment).toHaveLength(0);
  });

  it('forgets the oldest steps beyond the limit', () => {
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) store.getState().setFloor({ width: 30 + i + 1 });
    for (let i = 0; i < HISTORY_LIMIT + 10; i++) store.getState().undo();
    expect(store.getState().floor.width).toBe(30 + 10);
    expect(store.getState().canUndo).toBe(false);
  });

  it('loadDocument clears the history', () => {
    place();
    store.getState().loadDocument(createProject());
    expect(store.getState().canUndo).toBe(false);
    expect(store.getState().canRedo).toBe(false);
  });
});

describe('LE-3 coalescing', () => {
  it('beginEdit/endEdit makes many writes one step', () => {
    const e = place();
    const token = store.getState().beginEdit();
    for (const n of ['1', '12', '12.5'])
      store.getState().updateEquipment(e.id, { height: Number(n) });
    store.getState().endEdit(token);
    store.getState().undo();
    expect(store.getState().equipment[0]!.height).toBe(e.height);
    expect(store.getState().equipment).toHaveLength(1);
  });

  it('endEdit closes only its own session', () => {
    const e = place();
    const stale = store.getState().beginEdit();
    store.getState().beginEdit(); // a newer session replaces it
    store.getState().endEdit(stale); // must not close the newer one
    store.getState().updateEquipment(e.id, { height: 2 });
    store.getState().updateEquipment(e.id, { height: 3 });
    store.getState().undo();
    expect(store.getState().equipment[0]!.height).toBe(e.height); // both writes were one step
  });

  it('an edit session that changed nothing leaves no step', () => {
    place();
    store.getState().endEdit(store.getState().beginEdit());
    store.getState().undo();
    expect(store.getState().equipment).toEqual([]);
  });

  it('typing 12.5 into a properties field is one undo step', async () => {
    const user = userEvent.setup();
    const e = place();
    store.getState().selectEquipment(e.id, false);
    render(<PropertiesPanel useStore={store} />);
    const w = await screen.findByLabelText(/^width/i);
    await user.click(w);
    await user.clear(w);
    await user.type(w, '12.5');
    await user.tab();
    expect(store.getState().equipment[0]!.footprint.width).toBe(12.5);
    store.getState().undo();
    expect(store.getState().equipment[0]!.footprint.width).toBe(e.footprint.width);
  });

  it('typing into a floor field is one undo step', async () => {
    const user = userEvent.setup();
    render(<FloorPanel useStore={store} />);
    const w = screen.getByLabelText(/floor width/i);
    await user.click(w);
    await user.clear(w);
    await user.type(w, '45');
    await user.tab();
    expect(store.getState().floor.width).toBe(45);
    store.getState().undo();
    expect(store.getState().floor.width).toBe(30);
  });
});

describe('LE-3 keyboard shortcuts', () => {
  // The module-level store is what the editor uses.
  const Harness = () => {
    useEditorShortcuts(false);
    useUndoShortcuts(false);
    return <input aria-label="text field" />;
  };
  const fresh = () => {
    useEditorStore.getState().loadDocument(createProject());
    useEditorStore.getState().placeEquipment('base-workstation', { x: 4, y: 4 });
    render(<Harness />);
    return userEvent.setup();
  };

  it('Ctrl+Z undoes and Ctrl+Shift+Z redoes', async () => {
    const user = fresh();
    await user.keyboard('{Control>}z{/Control}');
    expect(useEditorStore.getState().equipment).toHaveLength(0);
    await user.keyboard('{Control>}{Shift>}z{/Shift}{/Control}');
    expect(useEditorStore.getState().equipment).toHaveLength(1);
  });

  it('Cmd+Z and Cmd+Shift+Z work too', async () => {
    const user = fresh();
    await user.keyboard('{Meta>}z{/Meta}');
    expect(useEditorStore.getState().equipment).toHaveLength(0);
    await user.keyboard('{Meta>}{Shift>}z{/Shift}{/Meta}');
    expect(useEditorStore.getState().equipment).toHaveLength(1);
  });

  it('is ignored while focus is in a text input', async () => {
    const user = fresh();
    await user.click(screen.getByLabelText('text field'));
    await user.keyboard('{Control>}z{/Control}');
    expect(useEditorStore.getState().equipment).toHaveLength(1);
  });
});

describe('PR-1 undo on the Products screen', () => {
  it('Ctrl+Z undoes a product edit with only the project-level undo shortcuts mounted', async () => {
    const user = userEvent.setup();
    const Harness = () => {
      useUndoShortcuts(false);
      return null;
    };
    const { useEditorStore: s } = await import('./editorStore');
    s.getState().loadDocument({ ...createProject() });
    render(<Harness />);
    s.getState().addProduct();
    await user.keyboard('{Control>}z{/Control}');
    expect(s.getState().products).toEqual([]);
  });
});
