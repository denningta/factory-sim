import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from './index';

describe('sim-engine package', () => {
  it('is wired into the workspace', () => {
    expect(PACKAGE_NAME).toBe('@factory-sim/sim-engine');
  });
});
