import { describe, expect, it } from 'vitest';
import { BASE_EQUIPMENT_TYPES, type EquipmentType } from '@factory-sim/schema';
import { equipmentParts, partBounds, shapeSignature } from './shapes';

describe('Each type renders as a distinct, recognizable 3D shape', () => {
  it('every base type yields a different shape', () => {
    const sigs = BASE_EQUIPMENT_TYPES.map((t) => shapeSignature(equipmentParts(t)));
    expect(new Set(sigs).size).toBe(BASE_EQUIPMENT_TYPES.length);
  });

  it('shape signatures compare geometry only, not tone (#57)', () => {
    const parts = equipmentParts(BASE_EQUIPMENT_TYPES[0]!);
    const retoned = parts.map((p) => ({ ...p, tone: p.tone * 0.5 }));
    expect(shapeSignature(retoned)).toBe(shapeSignature(parts));
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

  it('the sink reads as shipping: a dark open top and a stack of pallets', () => {
    const sink = BASE_EQUIPMENT_TYPES.find((t) => t.behavior === 'sink')!;
    const parts = equipmentParts(sink);
    const darkest = Math.min(...parts.map((p) => p.tone));
    expect(darkest).toBeLessThanOrEqual(0.3);
    const top = parts.find((p) => p.tone === darkest)!;
    expect(top.position[1]).toBeGreaterThan(sink.height * 0.9);
    // At least three pallet-like slabs share one column.
    const slabs = parts.filter((p) => p.shape === 'box' && p.size[1] < sink.height * 0.2);
    const columns = new Map<number, number>();
    for (const p of slabs) columns.set(p.position[0], (columns.get(p.position[0]) ?? 0) + 1);
    expect(Math.max(...columns.values())).toBeGreaterThanOrEqual(3);
  });
});

describe('Shapes stay inside the footprint for edited dimensions (#61)', () => {
  const sizes = [
    { width: 0.2, length: 3 },
    { width: 3, length: 0.4 },
    { width: 2, length: 0.5 },
    { width: 10, length: 0.4 },
    { width: 0.1, length: 0.1 },
    { width: 10, length: 10 },
  ];
  it('every shape fits any edited footprint and height', () => {
    for (const t of BASE_EQUIPMENT_TYPES)
      for (const footprint of sizes)
        for (const height of [0.3, 3]) {
          const b = partBounds(equipmentParts({ ...t, footprint, height }));
          const eps = 1e-9;
          expect(b.min[0]).toBeGreaterThanOrEqual(-footprint.width / 2 - eps);
          expect(b.max[0]).toBeLessThanOrEqual(footprint.width / 2 + eps);
          expect(b.min[2]).toBeGreaterThanOrEqual(-footprint.length / 2 - eps);
          expect(b.max[2]).toBeLessThanOrEqual(footprint.length / 2 + eps);
          expect(b.max[1]).toBeLessThanOrEqual(height + eps);
        }
  });
});
