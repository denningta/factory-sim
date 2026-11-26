import { describe, expect, it } from 'vitest';
import { BASE_EQUIPMENT_TYPES } from '@factory-sim/schema';
import { MODELS, modelsFor, resolveModel } from './registry';
import { partBounds } from './parts';
import type { ModelPart } from './types';

/** SF-7: the autoclave model and its built-in equipment type. */
const SIZE = { width: 2.4, length: 5, height: 2.6 };
const autoclave = () => MODELS.find((m) => m.id === 'asc-autoclave');

const isCylinder = (p: ModelPart): p is Extract<ModelPart, { shape: 'cylinder' }> =>
  p.shape === 'cylinder';

describe('SF-7 AC1: the asc-autoclave registry model', () => {
  it('is registered for workstations and offered by the type editor picker', () => {
    expect(autoclave()?.behaviors).toContain('workstation');
    expect(modelsFor('workstation').map((m) => m.id)).toContain('asc-autoclave');
  });

  it('has a horizontal pressure vessel: a cylinder lying along the length axis', () => {
    const { lods } = autoclave()!.build(SIZE, {});
    const vessels = lods[0]!.filter(isCylinder).filter((c) => c.axis === 'z');
    expect(vessels.length).toBeGreaterThanOrEqual(3); // shell, domed door, rear head
    const shell = vessels.reduce((a, b) => (b.height > a.height ? b : a));
    const b = partBounds([shell]);
    expect(b.max[2]! - b.min[2]!).toBeGreaterThan((b.max[0]! - b.min[0]!) * 1.5);
  });

  it('rests the vessel on saddle supports: boxes from the floor up to the vessel', () => {
    const { lods } = autoclave()!.build(SIZE, {});
    const saddles = lods[0]!.filter(
      (p) => p.shape === 'box' && p.role === 'frame' && partBounds([p]).min[1] < 1e-9,
    );
    expect(saddles.length).toBeGreaterThanOrEqual(2);
  });

  it('has load rails and a cart in front of the door whose slots hold the batch', () => {
    const { lods, anchors } = autoclave()!.build(SIZE, {});
    const vessel = partBounds(lods[0]!.filter((p) => isCylinder(p) && p.axis === 'z'));
    for (let i = 0; i < 4; i++) {
      const [x, y, z] = anchors.queueSlot(i);
      expect(z).toBeGreaterThan(vessel.max[2]!); // waiting parts sit on the cart, outside the vessel
      expect(Math.abs(x)).toBeLessThan(SIZE.width / 2);
      expect(y).toBeGreaterThan(0);
    }
    const rails = lods[0]!.filter(
      (p) => p.shape === 'box' && p.size[2] > p.size[0] * 4 && p.role === 'dark',
    );
    expect(rails.length).toBeGreaterThanOrEqual(2);
  });

  it('has a control cabinet and a status light on a pole at its real size', () => {
    const { lods, anchors } = autoclave()!.build(SIZE, {});
    expect(anchors.statusLight).toBeDefined();
    expect(lods[0]!.some((p) => p.shape === 'cylinder' && p.fixed && p.role === 'accent')).toBe(
      true,
    );
    expect(lods[0]!.some((p) => p.shape === 'box' && p.role === 'screen')).toBe(true);
  });

  it('has a hinge beside the door', () => {
    const { lods } = autoclave()!.build(SIZE, {});
    expect(
      lods[0]!.some((p) => p.shape === 'box' && p.role === 'dark' && p.size[1] > p.size[0]),
    ).toBe(true);
  });

  it('has an operator spot at the front and a work surface inside the vessel', () => {
    const { anchors } = autoclave()!.build(SIZE, {});
    expect(anchors.operator![2]).toBeGreaterThan(SIZE.length / 2);
    expect(anchors.operatorFacing).toBeDefined();
    expect(anchors.workSurface![2]).toBeLessThan(0);
  });
});

describe('SF-7 AC2: the built-in Autoclave equipment type', () => {
  const type = () => BASE_EQUIPMENT_TYPES.find((t) => t.id === 'base-autoclave');

  it('is a workstation with automatic labor and a per-batch cure cycle', () => {
    const t = type()!;
    expect(t.behavior).toBe('workstation');
    const p = t.params as {
      labor: { mode: string };
      cycle: { mode: string; time: { kind: string; value: number } };
      batchSize: number;
      capacity: number;
      maxWait: number;
    };
    expect(p.labor.mode).toBe('automatic');
    expect(p.cycle.mode).toBe('perBatch');
    expect(p.cycle.time.value).toBeGreaterThan(600);
    expect(p.batchSize).toBeGreaterThan(1);
    expect(p.maxWait).toBeGreaterThan(0);
  });

  it('is drawn with the asc-autoclave model at real scale', () => {
    const t = type()!;
    expect(t.model).toBe('asc-autoclave');
    expect(resolveModel(t).id).toBe('asc-autoclave');
    expect(t.footprint.length).toBeGreaterThanOrEqual(4);
    expect(t.height).toBeGreaterThanOrEqual(2);
  });
});
