import { describe, expect, it } from 'vitest';
import {
  BUILT_IN_EQUIPMENT_TYPES,
  BASE_EQUIPMENT_TYPES,
  CURRENT_SCHEMA_VERSION,
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
    const ws = {
      ...BASE_EQUIPMENT_TYPES[0]!,
      params: { capacity: 2, batchSize: 3, labor: { mode: 'manual' as const } },
    };
    const result = equipmentTypeSchema.safeParse(ws);
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.issues[0]?.path).toEqual(['params', 'batchSize']);
    expect(
      equipmentTypeSchema.safeParse({
        ...ws,
        params: { capacity: 3, batchSize: 3, labor: { mode: 'manual' as const } },
      }).success,
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
      ports: type.ports,
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

describe('schema v1 → current upgrade (real chain)', () => {
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
    expect(result.project.schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(result.project.equipment[0]).toEqual({
      ...v1.equipment[0],
      color: '#8a94a6',
      params: { capacity: 1, batchSize: 1, labor: { mode: 'manual' } },
      ports: [
        { id: 'in', kind: 'input', u: 0, v: -0.5 },
        { id: 'out', kind: 'output', u: 0, v: 0.5 },
      ],
    });
    expect(result.project.equipment[1]).toMatchObject({
      footprint: { width: 0.6, length: 4 },
      params: { speed: 0.2 },
    });
    expect(result.project.connections).toEqual([
      {
        id: 'k1',
        from: { equipmentId: 's1', portId: 'out' },
        to: { equipmentId: 'c1', portId: 'in' },
        capacity: 0,
        transfer: { kind: 'instant' },
      },
    ]);
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

describe('ports (schema v3, FL-1/EQ-4 contract)', () => {
  it('gives each built-in type default ports: input at one end, output at the other', () => {
    const ws = BASE_EQUIPMENT_TYPES.find((t) => t.behavior === 'workstation')!;
    expect(ws.ports).toEqual([
      { id: 'in', kind: 'input', u: 0, v: -0.5 },
      { id: 'out', kind: 'output', u: 0, v: 0.5 },
    ]);
    const src = BASE_EQUIPMENT_TYPES.find((t) => t.behavior === 'source')!;
    const snk = BASE_EQUIPMENT_TYPES.find((t) => t.behavior === 'sink')!;
    expect(src.ports.map((p) => p.kind)).toEqual(['output']);
    expect(snk.ports.map((p) => p.kind)).toEqual(['input']);
  });

  it('enforces the port rules per behavior', () => {
    const src = BASE_EQUIPMENT_TYPES.find((t) => t.behavior === 'source')!;
    const withInput = { ...src, ports: [...src.ports, { id: 'in', kind: 'input', u: 0, v: -0.5 }] };
    expect(equipmentTypeSchema.safeParse(withInput).success).toBe(false);
    const ws = BASE_EQUIPMENT_TYPES.find((t) => t.behavior === 'workstation')!;
    const noOutput = { ...ws, ports: ws.ports.filter((p) => p.kind === 'input') };
    const r = equipmentTypeSchema.safeParse(noOutput);
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0]?.message).toMatch(/at least one output/);
  });

  it('keeps ports on the footprint and their ids unique', () => {
    const ws = BASE_EQUIPMENT_TYPES.find((t) => t.behavior === 'workstation')!;
    const off = { ...ws, ports: [{ ...ws.ports[0]!, u: 0.6 }, ws.ports[1]!] };
    expect(equipmentTypeSchema.safeParse(off).success).toBe(false);
    const interior = { ...ws, ports: [{ ...ws.ports[0]!, u: 0.1, v: 0.2 }, ws.ports[1]!] };
    expect(equipmentTypeSchema.safeParse(interior).success).toBe(false);
    const side = { ...ws, ports: [{ ...ws.ports[0]!, u: -0.5, v: 0.1 }, ws.ports[1]!] };
    expect(equipmentTypeSchema.safeParse(side).success).toBe(true);
    const dup = { ...ws, ports: [ws.ports[0]!, { ...ws.ports[1]!, id: 'in' }] };
    expect(equipmentTypeSchema.safeParse(dup).success).toBe(false);
  });

  it('instantiate copies ports independently of the type', () => {
    const ws = BASE_EQUIPMENT_TYPES.find((t) => t.behavior === 'workstation')!;
    const e = instantiate(ws, { id: 'w1', position: { x: 0, y: 0 } });
    expect(e.ports).toEqual(ws.ports);
    e.ports[0]!.u = 0.25;
    expect(ws.ports[0]!.u).toBe(0);
  });
});

describe('schema v2 → v3 upgrade', () => {
  it('maps v2 connections onto the default ports, with no buffer', () => {
    const v2 = {
      schemaVersion: 2,
      floor: { width: 30, length: 20, gridSpacing: 1 },
      equipment: [
        { ...instantiate(BASE_EQUIPMENT_TYPES[3]!, { id: 'src', position: { x: 1, y: 1 } }) },
        { ...instantiate(BASE_EQUIPMENT_TYPES[4]!, { id: 'snk', position: { x: 9, y: 1 } }) },
      ].map(({ ports: _p, ...e }) => e),
      connections: [{ id: 'k', from: 'src', to: 'snk' }],
      products: [],
      cycleTimes: [],
    };
    const result = loadProject(v2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.connections[0]).toEqual({
      id: 'k',
      from: { equipmentId: 'src', portId: 'out' },
      to: { equipmentId: 'snk', portId: 'in' },
      capacity: 0,
      transfer: { kind: 'instant' },
    });
  });

  it('reports a v2 connection out of a sink instead of inventing a port', () => {
    const v2 = {
      schemaVersion: 2,
      floor: { width: 30, length: 20, gridSpacing: 1 },
      equipment: [
        instantiate(BASE_EQUIPMENT_TYPES[4]!, { id: 'snk', position: { x: 9, y: 1 } }),
        instantiate(BASE_EQUIPMENT_TYPES[0]!, { id: 'w', position: { x: 1, y: 1 } }),
      ].map(({ ports: _p, ...e }) => e),
      connections: [{ id: 'k', from: 'snk', to: 'w' }],
      products: [],
      cycleTimes: [],
    };
    const result = loadProject(v2);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('has no port "out"');
  });
});

describe('schema v7: equipment `model` key (ADR-0015)', () => {
  const ws = BASE_EQUIPMENT_TYPES.find((t) => t.behavior === 'workstation')!;

  it('is optional: built-in types have none and still validate', () => {
    for (const type of BASE_EQUIPMENT_TYPES) expect(type.model).toBeUndefined();
    expect(equipmentTypeSchema.safeParse(ws).success).toBe(true);
  });

  it('accepts a kebab-case model id on a type', () => {
    for (const model of ['cnc', 'cnc-enclosure', 'oven-2']) {
      expect(equipmentTypeSchema.safeParse({ ...ws, model }).success, model).toBe(true);
    }
  });

  it('rejects ids that are not kebab-case or longer than 64 characters', () => {
    for (const model of [
      '',
      'CNC',
      'cnc enclosure',
      '-cnc',
      'cnc-',
      'cnc--x',
      '../x',
      'a'.repeat(65),
    ]) {
      expect(equipmentTypeSchema.safeParse({ ...ws, model }).success, model).toBe(false);
    }
  });

  it('is copied to placed instances like every other type setting', () => {
    const e = instantiate(
      { ...ws, model: 'cnc-enclosure' },
      { id: 'w1', position: { x: 0, y: 0 } },
    );
    expect(e.model).toBe('cnc-enclosure');
    const project = createProject();
    project.equipment = [e];
    expect(validateProject(project).ok).toBe(true);
  });
});

describe('SF-7: built-in autoclave type', () => {
  const autoclave = BUILT_IN_EQUIPMENT_TYPES.find((t) => t.id === 'base-autoclave');

  it('is a valid automatic perBatch workstation drawn as asc-autoclave', () => {
    expect(equipmentTypeSchema.safeParse(autoclave).success).toBe(true);
    expect(autoclave?.behavior).toBe('workstation');
    expect(autoclave?.model).toBe('asc-autoclave');
    if (autoclave?.behavior !== 'workstation') throw new Error('expected a workstation');
    expect(autoclave.params.labor.mode).toBe('automatic');
    expect(autoclave.params.cycle?.mode).toBe('perBatch');
    expect(autoclave.params.maxWait).toBeGreaterThan(0);
    // One vessel cures one batch at a time (SF-5 review).
    expect(autoclave.params.capacity).toBe(autoclave.params.batchSize);
  });
});
