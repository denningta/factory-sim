import { describe, expect, it } from 'vitest';
import { createRng, createSimulation } from './index';

// Replaced by real tests in SE-1. These keep the stubs covered so the 90% gate holds.
describe('sim-engine public API', () => {
  it('exposes the kernel factories, not implemented until SE-1', () => {
    expect(() => createSimulation({ seed: 1 })).toThrow('SE-1');
    expect(() => createRng(1)).toThrow('SE-1');
  });
});
