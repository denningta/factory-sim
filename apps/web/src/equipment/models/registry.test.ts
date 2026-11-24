import { describe, expect, it } from 'vitest';
import { BASE_EQUIPMENT_TYPES, EQUIPMENT_BEHAVIORS, modelIdSchema } from '@factory-sim/schema';
import { defaultModelFor, MODELS, modelsFor, resolveModel } from './registry';
import { structureKey } from './parts';
import type { ModelDefinition } from './types';

const sizeOf = (t: (typeof BASE_EQUIPMENT_TYPES)[number]) => ({
  width: t.footprint.width,
  length: t.footprint.length,
  height: t.height,
});

describe('UI-7 AC1: a model registry', () => {
  it('every model has a unique kebab-case id, a label and at least one behavior', () => {
    expect(MODELS.length).toBeGreaterThanOrEqual(EQUIPMENT_BEHAVIORS.length);
    const ids = MODELS.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const m of MODELS) {
      expect(modelIdSchema.safeParse(m.id).success).toBe(true);
      expect(m.label.trim()).not.toBe('');
      expect(m.behaviors.length).toBeGreaterThan(0);
    }
  });

  it('every behavior has a registered default model that suits it', () => {
    for (const b of EQUIPMENT_BEHAVIORS) {
      const m = defaultModelFor(b);
      expect(MODELS).toContain(m);
      expect(m.behaviors).toContain(b);
    }
  });

  it('modelsFor lists only the models that suit a behavior', () => {
    for (const b of EQUIPMENT_BEHAVIORS) {
      const list = modelsFor(b);
      expect(list).toContain(defaultModelFor(b));
      expect(list.every((m) => m.behaviors.includes(b))).toBe(true);
      expect(list).toEqual(MODELS.filter((m) => m.behaviors.includes(b)));
    }
  });
});

describe('UI-7 AC4: resolveModel falls back to the behavior default', () => {
  const bench: ModelDefinition = {
    ...defaultModelFor('workstation'),
    id: 'test-bench',
    label: 'Test bench',
    behaviors: ['workstation'],
  };
  const registry = [...MODELS, bench];

  it("returns the equipment's model when it is registered and suits the behavior", () => {
    expect(resolveModel({ behavior: 'workstation', model: 'test-bench' }, registry)).toBe(bench);
  });

  it('an absent model falls back to the default', () => {
    expect(resolveModel({ behavior: 'buffer' })).toBe(defaultModelFor('buffer'));
    expect(resolveModel({ behavior: 'buffer', model: undefined })).toBe(defaultModelFor('buffer'));
  });

  it('an unknown model id falls back to the default', () => {
    expect(resolveModel({ behavior: 'sink', model: 'removed-in-v9' }, registry)).toBe(
      defaultModelFor('sink'),
    );
  });

  it('a registered model that does not suit the behavior falls back to the default', () => {
    expect(resolveModel({ behavior: 'conveyor', model: 'test-bench' }, registry)).toBe(
      defaultModelFor('conveyor'),
    );
    const rack = defaultModelFor('buffer');
    expect(resolveModel({ behavior: 'workstation', model: rack.id })).toBe(
      defaultModelFor('workstation'),
    );
  });
});

describe('UI-7 AC8: the five current shapes are the behavior defaults', () => {
  it('each behavior default has its own structure', () => {
    const keys = BASE_EQUIPMENT_TYPES.map((t) =>
      structureKey(defaultModelFor(t.behavior).build(sizeOf(t), t.params).lods[0]!),
    );
    expect(new Set(keys).size).toBe(BASE_EQUIPMENT_TYPES.length);
  });

  it('the defaults keep the current part layout', () => {
    // Same part counts and shapes as the pre-registry shapes.ts (b = box, c = cylinder, f = taper).
    const expected: Record<string, string> = {
      workstation: 'bbc',
      buffer: 'bbbbbbbbbb',
      conveyor: 'bbbbbbb',
      source: 'bcf',
      sink: 'bbbbbb',
    };
    for (const t of BASE_EQUIPMENT_TYPES) {
      const parts = defaultModelFor(t.behavior).build(sizeOf(t), t.params).lods[0]!;
      const sig = parts
        .map((p) => (p.shape === 'box' ? 'b' : p.radiusTop === p.radiusBottom ? 'c' : 'f'))
        .join('');
      expect(sig).toBe(expected[t.behavior]);
    }
  });

  it('the sink keeps its dark open top', () => {
    const t = BASE_EQUIPMENT_TYPES.find((x) => x.behavior === 'sink')!;
    const parts = defaultModelFor('sink').build(sizeOf(t), t.params).lods[0]!;
    const mouth = parts.find((p) => p.role === 'dark')!;
    expect(mouth.position[1]).toBeGreaterThan(t.height * 0.9);
  });
});
