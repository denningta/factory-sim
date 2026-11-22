import { expect, it } from 'vitest';

it('deliberately fails to prove branch protection blocks merging', () => {
  expect(1).toBe(2);
});
