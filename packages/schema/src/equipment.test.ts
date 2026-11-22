import { describe, expect, it } from 'vitest';
import {
  BASE_EQUIPMENT_TYPES,
  EQUIPMENT_BEHAVIORS,
  createProject,
  equipmentTypeSchema,
  instantiate,
  loadProject,
  validateProject,
} from './index';

describe('equipment types (ADR-0010, EQ-1 contract)', () => {
  it('has one valid built-in type per base behavior', () => {
    expect(BASE_EQUIPMENT_TYPES.map((t) => t.behavior).sort()).toEqual(
      [...EQUIPMENT_BEHAVIORS].sort(),
    );
    for (const type of BASE_EQUIPMENT_TYPES) {
      expect(equipmentTypeSchema.safeParse(type).success, type.id).toBe(true);
    }
    expect(new Set(BASE_EQUIPMENT_TYPES.map((t) => t.id)).size).toBe(5);
  });

  it('rejects params that do not match the behavior', () => {
    const bad = { ...BASE_EQUIPMENT_TYPES[0]!, params: { speed: 1 } };
    const result = equipmentTypeSchema.safeParse(bad);
    expect(result.success).toBe(false);
  });

  it('rejects a workstation batch size larger than its capacity', () => {
    const ws = { ...BASE_EQUIPMENT_TYPES[0]!, params: { capacity: 2, batchSize: 3 } };
    const result = equipmentTypeSchema.safeParse(ws);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(['params', 'batchSize']);
    expect(
      equipmentTypeSchema.safeParse({ ...ws, params: { capacity: 3, batchSize: 3 } }).success,
    ).toBe(true);
  });

  it('rejects non-integer capacity and non-positive conveyor speed', () => {
    const ws = { ...BASE_EQUIPMENT_TYPES[0]!, params: { capacity: 1.5, batchSize: 1 } };
    const conv = BASE_EQUIPMENT_TYPES.find((t) => t.behavior === 'conveyor')!;
    expect(equipmentTypeSchema.safeParse(ws).success).toBe(false);
    expect(equipmentTypeSchema.safeParse({ ...conv, params: { speed: 0 } }).success).toBe(false);
  });
});

describe('instantiate: placed instances own a copy of their type settings', () => {
  const type = BASE_EQUIPMENT_TYPES.find((t) => t.behavior === 'buffer')!;

  it('copies behavior, params, footprint, height and color, and records the type id', () => {
    const e = instantiate(type, { id: 'b1', position: { x: 3, y: 4 } });
    expect(e).toEqual({
      id: 'b1',
      name: type.name,
      typeId: type.id,
      behavior: 'buffer',
      params: { capacity: 10 },
      footprint: type.footprint,
      height: type.height,
      color: type.color,
      position: { x: 3, y: 4 },
      rotation: 0,
    });
  });

  it('is independent of the type afterwards', () => {
    const e = instantiate(type, { id: 'b1', position: { x: 0, y: 0 } });
    if (e.behavior !== 'buffer') throw new Error('unreachable');
    e.params.capacity = 99;
    e.footprint.width = 9;
    expect(type.params).toEqual({ capacity: 10 });
    expect(type.footprint.width).toBe(1.2);
  });

  it('produces equipment that validates inside a project', () => {
    const project = createProject();
    project.equipment = BASE_EQUIPMENT_TYPES.map((t, i) =>
      instantiate(t, { id: `e${i}`, position: { x: i * 3, y: 2 }, rotation: Math.PI / 2 }),
    );
    expect(validateProject(project).ok).toBe(true);
  });
});

describe('schema v1 → v2 upgrade (real chain)', () => {
  const v1 = {
    schemaVersion: 1,
    floor: { width: 30, length: 20, gridSpacing: 1 },
    equipment: [
      {
        id: 's1',
        name: 'Saw',
        typeId: 'base-workstation',
        behavior: 'workstation',
        position: { x: 5, y: 5 },
        rotation: 0,
        footprint: { width: 2, length: 1.5 },
        height: 1.2,
      },
      {
        id: 'c1',
        name: 'Belt',
        typeId: 'base-conveyor',
        behavior: 'conveyor',
        position: { x: 8, y: 5 },
        rotation: 0,
        footprint: { width: 0.6, length: 4 },
        height: 0.9,
      },
    ],
    connections: [{ id: 'k1', from: 's1', to: 'c1' }],
    products: [],
    cycleTimes: [],
  };

  it('adds each instance its own color and default params, keeping everything else', () => {
    const result = loadProject(v1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.schemaVersion).toBe(2);
    expect(result.project.equipment[0]).toEqual({
      ...v1.equipment[0],
      color: '#8a94a6',
      params: { capacity: 1, batchSize: 1 },
    });
    expect(result.project.equipment[1]).toMatchObject({
      footprint: { width: 0.6, length: 4 },
      params: { speed: 0.2 },
    });
    expect(result.project.connections).toEqual(v1.connections);
  });

  it.each([
    ['missing', undefined],
    ['a string', 'junk'],
    ['an object', {}],
  ])('rejects a v1 document whose equipment is %s instead of emptying it', (_label, value) => {
    const result = loadProject({ ...v1, equipment: value });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('equipment');
  });

  it('does not treat inherited keys such as "constructor" as a behavior', () => {
    const result = loadProject({
      ...v1,
      equipment: [{ ...v1.equipment[0], behavior: 'constructor' }],
    });
    expect(result.ok).toBe(false);
  });

  it('reports invalid v1 equipment through validation instead of crashing', () => {
    const broken = { ...v1, equipment: [null, { behavior: 'teleporter' }] };
    const result = loadProject(broken);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('equipment[0]');
  });
});
