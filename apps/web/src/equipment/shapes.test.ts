import { describe, expect, it } from 'vitest';
import { BASE_EQUIPMENT_TYPES, type EquipmentType } from '@factory-sim/schema';
import { equipmentParts, partBounds, shapeSignature } from './shapes';

describe('Each type renders as a distinct, recognizable 3D shape', () => {
  it('every base type yields a different shape', () => {
    const sigs = BASE_EQUIPMENT_TYPES.map((t) => shapeSignature(equipmentParts(t)));
    expect(new Set(sigs).size).toBe(BASE_EQUIPMENT_TYPES.length);
  });

  it('every shape has several parts, not a single plain box', () => {
    for (const t of BASE_EQUIPMENT_TYPES) expect(equipmentParts(t).length).toBeGreaterThan(2);
  });

  it('every shape fits its default footprint and height and sits on the floor', () => {
    for (const t of BASE_EQUIPMENT_TYPES) {
      const b = partBounds(equipmentParts(t));
      const eps = 1e-9;
      expect(b.min[0]).toBeGreaterThanOrEqual(-t.footprint.width / 2 - eps);
      expect(b.max[0]).toBeLessThanOrEqual(t.footprint.width / 2 + eps);
      expect(b.min[2]).toBeGreaterThanOrEqual(-t.footprint.length / 2 - eps);
      expect(b.max[2]).toBeLessThanOrEqual(t.footprint.length / 2 + eps);
      expect(b.min[1]).toBeCloseTo(0, 9);
      expect(b.max[1]).toBeCloseTo(t.height, 9);
    }
  });

  it('shapes follow the settings, so an edited footprint or height changes the model', () => {
    const base = BASE_EQUIPMENT_TYPES.find((t) => t.behavior === 'workstation')!;
    const big: EquipmentType = { ...base, footprint: { width: 4, length: 3 }, height: 2 };
    const b = partBounds(equipmentParts(big));
    expect(b.max[0] - b.min[0]).toBeCloseTo(4, 9);
    expect(b.max[1]).toBeCloseTo(2, 9);
  });
});
