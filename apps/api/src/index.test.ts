import { describe, expect, it } from 'vitest';
import { PACKAGE_NAME } from './index';

describe('api package', () => {
  it('is wired into the workspace', () => {
    expect(PACKAGE_NAME).toBe('@factory-sim/api');
  });
});
