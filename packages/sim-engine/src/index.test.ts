import { describe, expect, it } from 'vitest';
import { createRng, createSimulation, createTally } from './index';

describe('sim-engine public API', () => {
  it('exposes the kernel factories (implemented by SE-1)', () => {
    expect(typeof createSimulation).toBe('function');
    expect(typeof createRng).toBe('function');
    expect(typeof createTally).toBe('function');
  });
});
