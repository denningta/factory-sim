import { beforeEach, describe, expect, it } from 'vitest';
import { createProject } from '@factory-sim/schema';
import { createEditorStore } from '../layout/editorStore';
import { documentForSave } from '../projects/document';
import {
  DEFAULT_RUN_SETTINGS,
  fromProjectRun,
  toProjectRun,
  validateRunSettings,
} from './runSettings';

let store: ReturnType<typeof createEditorStore>;
const s = () => store.getState();
beforeEach(() => {
  store = createEditorStore();
});

const run = (o = {}) => ({ ...DEFAULT_RUN_SETTINGS, ...o });

describe('SE-7: run settings saved with the project', () => {
  it('AC1: warm-up, length and seed round-trip through the project document and reload', () => {
    const ui = run({ warmUpHours: 2, runLength: 3, runUnit: 'hours', seedMode: 'random', seed: 9 });
    const saved = toProjectRun(ui);
    expect(saved).toEqual({
      warmUp: 7200,
      length: { unit: 'seconds', value: 10800 },
      seed: { mode: 'random', value: 9 },
    });
    expect(fromProjectRun(saved)).toEqual(ui);
    expect(fromProjectRun(toProjectRun(run({ runLength: 2.5 })))).toEqual(run({ runLength: 2.5 }));
    // Through the store and documentForSave, then loadDocument (a reload).
    s().applyRun(saved, 8 * 3600);
    const doc = documentForSave(createProject(), { ...s(), run: s().run });
    expect(doc.run).toEqual(saved);
    const other = createEditorStore();
    other.getState().loadDocument(doc);
    expect(other.getState().run).toEqual(saved);
  });

  it('AC2: applying changes the store (autosave watches it) and undo reverts run and shift length together', () => {
    const before = s().run;
    const next = toProjectRun(run({ warmUpHours: 1, runLength: 4 }));
    s().applyRun(next, 4 * 3600);
    expect(s().run).toEqual(next);
    expect(s().shiftLength).toBe(4 * 3600);
    s().undo();
    expect(s().run).toEqual(before);
    expect(s().shiftLength).toBe(8 * 3600);
    expect(s().canUndo).toBe(false);
  });

  it('AC2: re-applying identical settings adds no undo step', () => {
    s().applyRun(s().run, s().shiftLength);
    expect(s().canUndo).toBe(false);
  });

  it('AC3: warm-up must be shorter than the run length, in shifts using the shift length', () => {
    expect(validateRunSettings(run({ warmUpHours: 8, runLength: 1 }), 8 * 3600)).toMatch(/shorter/);
    expect(validateRunSettings(run({ warmUpHours: 9, runLength: 1 }), 8 * 3600)).toMatch(/shorter/);
    expect(validateRunSettings(run({ warmUpHours: 7, runLength: 1 }), 8 * 3600)).toBeNull();
    // The same warm-up fits a longer shift.
    expect(validateRunSettings(run({ warmUpHours: 9, runLength: 1 }), 10 * 3600)).toBeNull();
    expect(
      validateRunSettings(run({ warmUpHours: 3, runLength: 2, runUnit: 'hours' }), 8 * 3600),
    ).toMatch(/shorter/);
  });

  it('AC4: a random seed keeps the saved fixed value, so switching back to Fixed restores it', () => {
    const fixed = toProjectRun(run({ seed: 77 }));
    const random = toProjectRun(run({ seedMode: 'random', seed: 77 }));
    expect(random.seed).toEqual({ mode: 'random', value: 77 });
    s().applyRun(random, 8 * 3600);
    expect(fromProjectRun(s().run)).toMatchObject({ seedMode: 'random', seed: 77 });
    s().applyRun(fixed, 8 * 3600);
    expect(fromProjectRun(s().run)).toMatchObject({ seedMode: 'fixed', seed: 77 });
  });
});
