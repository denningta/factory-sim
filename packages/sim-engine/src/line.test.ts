import { describe, expect, it } from 'vitest';
import { createProject } from '@factory-sim/schema';
import { compileLine, createRun, type LineModel } from './index';

// Replaced by real tests in the line-model story. These keep the stubs covered (90% gate).
describe('line model public API', () => {
  it('exposes compileLine and createRun, not implemented yet', () => {
    expect(() => compileLine(createProject())).toThrow('line model');
    // A forged model, only to reach the stub; real models come from compileLine.
    const fake = {} as unknown as LineModel;
    expect(() => createRun(fake, { seed: 1, warmUp: 0, runLength: 1 })).toThrow('line model');
  });
});
