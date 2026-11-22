import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from './index';

describe('schema package', () => {
  it('is wired into the workspace', () => {
    expect(PACKAGE_NAME).toBe('@factory-sim/schema');
  });
});
