import { describe, expect, it } from 'vitest';
import { buildGridGeometry } from './gridLayout';

describe('grid geometry (#57)', () => {
  it('bounding sphere covers the whole floor, including after the floor grows', () => {
    for (const floor of [
      { width: 10, length: 6, gridSpacing: 1 },
      { width: 100, length: 60, gridSpacing: 2 },
    ]) {
      const g = buildGridGeometry(floor);
      const s = g.boundingSphere;
      expect(s).not.toBeNull();
      for (const [x, z] of [
        [0, 0],
        [floor.width, 0],
        [0, floor.length],
        [floor.width, floor.length],
      ] as const) {
        const d = Math.hypot(x - s!.center.x, 0 - s!.center.y, z - s!.center.z);
        expect(d).toBeLessThanOrEqual(s!.radius + 1e-6);
      }
    }
  });
});
