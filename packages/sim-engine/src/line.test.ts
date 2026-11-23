import { describe, expect, it } from 'vitest';
import { createProject } from '@factory-sim/schema';
import { compileLine, createRun } from './index';

// Replaced by real tests in the line-model story. These keep the stubs covered (90% gate).
describe('line model public API', () => {
  it('exposes compileLine and createRun, not implemented yet', () => {
    expect(() => compileLine(createProject())).toThrow('line model');
    expect(() => createRun({ kind: 'line-model' }, { seed: 1, warmUp: 0, runLength: 1 })).toThrow(
      'line model',
    );
  });
});
