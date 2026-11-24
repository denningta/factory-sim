import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  CURRENT_SCHEMA_VERSION,
  createProject,
  createUpgrader,
  loadProject,
  validateProject,
  BASE_EQUIPMENT_TYPES,
  instantiate,
  type Equipment,
  type EquipmentBehavior,
  type Project,
} from './index';

/** A small valid line: Source → S1 → S2 → Sink, two products. */
function sampleProject(): Project {
  return {
    ...createProject(),
    schemaVersion: CURRENT_SCHEMA_VERSION,
    floor: { width: 30, length: 20, gridSpacing: 1 },
    equipment: [
      eq('src', 'source', 1),
      eq('s1', 'workstation', 5),
      eq('s2', 'workstation', 10),
      eq('snk', 'sink', 15),
    ],
    connections: [link('c1', 'src', 's1'), link('c2', 's1', 's2'), link('c3', 's2', 'snk')],
    products: [
      {
        id: 'pA',
        partNumber: 'A-100',
        name: 'Product A',
        color: '#3b82f6',
        routing: [
          { id: 'pA-1', stationId: 's1' },
          { id: 'pA-2', stationId: 's2' },
        ],
      },
      {
        id: 'pB',
        partNumber: 'B-200',
        name: 'Product B',
        color: '#f59e0b',
        routing: [{ id: 'pB-1', stationId: 's1' }],
      },
    ],
    cycleTimes: [
      { productId: 'pA', stationId: 's1', time: { kind: 'fixed', value: 30 } },
      { productId: 'pA', stationId: 's2', time: { kind: 'fixed', value: 45 } },
      { productId: 'pB', stationId: 's1', time: { kind: 'fixed', value: 40 } },
    ],
  };
}

/** A default output → input connection with no buffer. */
function link(id: string, from: string, to: string): Project['connections'][number] {
  return {
    id,
    from: { equipmentId: from, portId: 'out' },
    to: { equipmentId: to, portId: 'in' },
    capacity: 0,
    transfer: { kind: 'instant' },
  };
}

function eq(id: string, behavior: EquipmentBehavior, x: number): Equipment {
  const type = BASE_EQUIPMENT_TYPES.find((t) => t.behavior === behavior)!;
  return instantiate(type, { id, name: id.toUpperCase(), position: { x, y: 5 } });
}

function expectInvalid(input: unknown, ...fragments: string[]) {
  const result = validateProject(input);
  expect(result.ok).toBe(false);
  if (!result.ok) {
    for (const fragment of fragments) expect(result.error).toContain(fragment);
  }
}

describe('PL-3 AC1: every saved project carries a schema version', () => {
  it('a new project carries the current schema version', () => {
    expect(createProject().schemaVersion).toBe(CURRENT_SCHEMA_VERSION);
    expect(validateProject(createProject()).ok).toBe(true);
  });

  it('a project without schemaVersion is rejected', () => {
    const { schemaVersion: _omit, ...rest } = sampleProject();
    expectInvalid(rest, 'schemaVersion');
    expect(loadProject(rest).ok).toBe(false);
  });

  it('a save in an older version is rejected; it must be upgraded first', () => {
    expectInvalid({ ...sampleProject(), schemaVersion: 0 }, 'schemaVersion');
  });
});

describe('PL-3 AC2: saves are validated; invalid data is rejected with a clear message', () => {
  it('accepts a valid project and returns it unchanged', () => {
    const project = sampleProject();
    const result = validateProject(project);
    expect(result).toEqual({ ok: true, project });
  });

  it('names the path of a wrongly typed field', () => {
    const p = sampleProject() as unknown as { floor: { width: unknown } };
    p.floor.width = 'thirty';
    expectInvalid(p, 'floor.width');
  });

  it('rejects non-positive lengths and times', () => {
    const p = sampleProject();
    p.floor.length = 0;
    p.cycleTimes[0]!.time = { kind: 'fixed', value: -1 };
    expectInvalid(p, 'floor.length', 'cycleTimes[0].time.value');
  });

  it('rejects duplicate ids', () => {
    const p = sampleProject();
    p.equipment[1]!.id = 'src';
    expectInvalid(p, 'equipment[1].id', 'Duplicate id "src"');
  });

  it('rejects duplicate part numbers', () => {
    const p = sampleProject();
    p.products[1]!.partNumber = 'A-100';
    expectInvalid(p, 'products[1].partNumber', 'Part number "A-100" is already used');
  });

  it('trims part numbers, so padded duplicates are caught', () => {
    const p = sampleProject();
    p.products[0]!.partNumber = '  A-100 ';
    const result = validateProject(p);
    expect(result.ok && result.project.products[0]!.partNumber).toBe('A-100');
    p.products[1]!.partNumber = 'A-100 ';
    expectInvalid(p, 'Part number "A-100" is already used');
  });

  it('rejects a connection from an object to itself', () => {
    const p = sampleProject();
    p.connections.push(link('c4', 's1', 's1'));
    expectInvalid(p, 'connections[3]', 'cannot connect "s1" to itself');
  });

  it('connects an output port to an input port only', () => {
    const p = sampleProject();
    p.connections[1]!.from.portId = 'in'; // s1 has an input called "in"
    p.connections[2]!.to.portId = 'nope';
    expectInvalid(
      p,
      'connections[1].from.portId',
      'is an input, expected an output',
      'connections[2].to.portId',
      'has no port "nope"',
    );
  });

  it('rejects connecting the same two ports twice', () => {
    const p = sampleProject();
    p.connections.push(link('c4', 'src', 's1'));
    expectInvalid(p, 'connections[3]', 'already connected');
  });

  it('accepts unlimited and positive connection capacities, rejects negative', () => {
    const p = sampleProject();
    p.connections[0]!.capacity = null;
    p.connections[1]!.capacity = 5;
    expect(validateProject(p).ok).toBe(true);
    p.connections[2]!.capacity = -1;
    expectInvalid(p, 'connections[2].capacity');
  });

  it('rejects references to unknown equipment', () => {
    const p = sampleProject();
    p.connections[0]!.to.equipmentId = 'ghost';
    p.products[0]!.routing[0]!.stationId = 'nowhere';
    expectInvalid(
      p,
      'connections[0].to.equipmentId',
      '"ghost"',
      'products[0].routing[0].stationId',
      '"nowhere"',
    );
  });

  it('rejects routing steps that point at non-workstations', () => {
    const p = sampleProject();
    p.products[0]!.routing[0]!.stationId = 'src';
    expectInvalid(p, 'products[0].routing[0].stationId', 'not a workstation');
  });

  it('rejects cycle times for unknown products and duplicate (product, station) keys', () => {
    const p = sampleProject();
    p.cycleTimes[0]!.productId = 'pZ';
    p.cycleTimes.push({ productId: 'pB', stationId: 's1', time: { kind: 'fixed', value: 1 } });
    expectInvalid(p, 'cycleTimes[0].productId', 'cycleTimes[3]', 'already has a cycle time');
  });

  it('rejects colors that are not #rrggbb', () => {
    const p = sampleProject();
    p.products[0]!.color = 'blue';
    expectInvalid(p, 'products[0].color');
  });

  it('rejects unknown top-level keys such as display units', () => {
    expectInvalid({ ...sampleProject(), displayUnits: 'ft' }, 'displayUnits');
  });

  it('rejects a document from a newer release with a clear message', () => {
    const result = loadProject({ ...sampleProject(), schemaVersion: CURRENT_SCHEMA_VERSION + 1 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/newer version of the app/);
  });

  it('rejects input that is not an object', () => {
    expect(loadProject(null).ok).toBe(false);
    expect(loadProject('{}').ok).toBe(false);
  });
});

describe('PL-3 AC3: an upgrade step converts an older version to the current one', () => {
  // Sample history: v1 stored the floor as `size: [width, length]`, v2 renamed fields,
  // v3 added `gridSpacing` with a default. The real chain has no steps yet (v1 is current).
  const sampleV3 = z.object({
    schemaVersion: z.literal(3),
    floor: z.object({ width: z.number(), length: z.number(), gridSpacing: z.number() }),
  });
  const upgrade = createUpgrader({
    currentVersion: 3,
    schema: sampleV3,
    steps: {
      1: (doc) => {
        const { floor, ...rest } = doc as { floor: { size: [number, number] } };
        return {
          ...rest,
          schemaVersion: 2,
          floor: { width: floor.size[0], length: floor.size[1] },
        };
      },
      2: (doc) => {
        const d = doc as { floor: object };
        return { ...d, schemaVersion: 3, floor: { ...d.floor, gridSpacing: 1 } };
      },
    },
  });

  it('upgrades a v1 sample through every step to the current version', () => {
    const v1 = { schemaVersion: 1, floor: { size: [30, 20] } };
    expect(upgrade(v1)).toEqual({
      ok: true,
      project: { schemaVersion: 3, floor: { width: 30, length: 20, gridSpacing: 1 } },
    });
  });

  it('does not mutate the input document', () => {
    const v1 = { schemaVersion: 1, floor: { size: [30, 20] } };
    upgrade(v1);
    expect(v1).toEqual({ schemaVersion: 1, floor: { size: [30, 20] } });
  });

  it('passes a current document straight to validation', () => {
    const v3 = { schemaVersion: 3, floor: { width: 1, length: 2, gridSpacing: 0.5 } };
    expect(upgrade(v3)).toEqual({ ok: true, project: v3 });
  });

  it('reports a missing upgrade step', () => {
    const result = upgrade({ schemaVersion: 0 });
    expect(result).toEqual({ ok: false, error: 'No upgrade step from schema version 0' });
  });

  it('reports a step that does not advance the version by one', () => {
    const broken = createUpgrader({
      currentVersion: 2,
      schema: z.object({ schemaVersion: z.literal(2) }),
      steps: { 1: (doc) => doc },
    });
    expect(broken({ schemaVersion: 1 })).toEqual({
      ok: false,
      error: 'Upgrade step from schema version 1 produced version 1, expected 2',
    });
  });

  it('reports a step that throws instead of throwing', () => {
    const throwing = createUpgrader({
      currentVersion: 2,
      schema: z.object({ schemaVersion: z.literal(2) }),
      steps: {
        1: () => {
          throw new Error('floor.size missing');
        },
      },
    });
    expect(throwing({ schemaVersion: 1 })).toEqual({
      ok: false,
      error: 'Upgrade from schema version 1 failed: floor.size missing',
    });
  });

  it('validates the upgraded result', () => {
    const v2Missing = { schemaVersion: 2, floor: { width: 'x', length: 2 } };
    const result = upgrade(v2Missing);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('floor.width');
  });

  it('the real loader accepts current-version documents', () => {
    expect(loadProject(sampleProject())).toEqual({ ok: true, project: sampleProject() });
  });
});

describe('schema v4 (Sprint 4 contract)', () => {
  it('accepts every duration kind and rejects bad triangular parameters', () => {
    const p = sampleProject();
    const kinds = [
      { kind: 'fixed', value: 30 },
      { kind: 'normal', mean: 30, stdDev: 3 },
      { kind: 'triangular', min: 20, mode: 30, max: 45 },
      { kind: 'lognormal', mean: 30, stdDev: 5 },
      { kind: 'exponential', mean: 30 },
    ] as const;
    for (const time of kinds) {
      p.cycleTimes[0]!.time = { ...time };
      expect(validateProject(p).ok, time.kind).toBe(true);
    }
    p.cycleTimes[0]!.time = { kind: 'triangular', min: 40, mode: 30, max: 45 };
    expectInvalid(p, 'cycleTimes[0].time.mode', 'min ≤ most likely ≤ max');
  });

  it('accepts an optional operation name on routing steps', () => {
    const p = sampleProject();
    p.products[0]!.routing[0]!.name = 'Cut stock';
    expect(validateProject(p).ok).toBe(true);
  });

  it('validates demand: known products, listed once, mix adds to 100', () => {
    const p = sampleProject();
    p.demand = {
      basis: 'mix',
      items: [
        { productId: 'pA', value: 60 },
        { productId: 'pB', value: 40 },
      ],
    };
    expect(validateProject(p).ok).toBe(true);
    p.products.push({ ...p.products[1]!, id: 'pC', partNumber: 'C-300', routing: [] });
    p.demand.items = ['pA', 'pB', 'pC'].map((productId) => ({ productId, value: 33.33 }));
    expect(validateProject(p).ok).toBe(true);
    p.products.pop();
    p.demand = {
      basis: 'mix',
      items: [
        { productId: 'pA', value: 60 },
        { productId: 'pB', value: 30 },
      ],
    };
    expectInvalid(p, 'demand.items', 'add up to 100');
    p.demand = {
      basis: 'perShift',
      items: [
        { productId: 'pZ', value: 5 },
        { productId: 'pZ', value: 1 },
      ],
    };
    expectInvalid(p, 'demand.items[0].productId', 'Unknown product', 'listed twice');
  });

  it('validates release sequences against products', () => {
    const p = sampleProject();
    p.release = {
      interval: { kind: 'exponential', mean: 45 },
      product: { kind: 'sequence', pattern: ['pA', 'pA', 'pB'] },
    };
    expect(validateProject(p).ok).toBe(true);
    p.release.product = { kind: 'sequence', pattern: ['pA', 'nope'] };
    expectInvalid(p, 'release.product.pattern[1]', 'Unknown product');
  });

  it('validates technicians: workstations only, no duplicates, unique ids', () => {
    const p = sampleProject();
    p.technicians = [{ id: 't1', name: 'Tech 1', walkSpeed: 1.2, stationIds: ['s1', 's2'] }];
    expect(validateProject(p).ok).toBe(true);
    p.technicians[0]!.stationIds = ['src', 's1', 's1'];
    expectInvalid(p, 'technicians[0].stationIds[0]', 'not a workstation', 'assigned twice');
    p.technicians = [{ id: 's1', name: 'X', walkSpeed: 1, stationIds: [] }];
    expectInvalid(p, 'technicians[0].id', 'Duplicate id');
  });

  it('accepts manual and automatic labor on workstations', () => {
    const p = sampleProject();
    const ws = p.equipment.find((e) => e.id === 's1')!;
    if (ws.behavior !== 'workstation') throw new Error('unreachable');
    ws.params.labor = {
      mode: 'automatic',
      loadTime: { kind: 'fixed', value: 5 },
      unloadTime: { kind: 'fixed', value: 4 },
    };
    expect(validateProject(p).ok).toBe(true);
  });

  it('accepts instant, fixed and speed transfers on connections', () => {
    const p = sampleProject();
    p.connections[0]!.transfer = { kind: 'fixed', time: { kind: 'fixed', value: 12 } };
    p.connections[1]!.transfer = { kind: 'speed', speed: 0.5 };
    expect(validateProject(p).ok).toBe(true);
    p.connections[1]!.transfer = { kind: 'speed', speed: 0 };
    expectInvalid(p, 'connections[1].transfer.speed');
  });

  it('upgrades a v3 document with planning defaults, manual labor and instant transfers', () => {
    const current = sampleProject();
    const { calendar: _c, demand: _d, release: _r, technicians: _t, ...rest } = current;
    const v3 = JSON.parse(
      JSON.stringify({
        ...rest,
        schemaVersion: 3,
        connections: current.connections.map(({ transfer: _x, ...c }) => c),
        equipment: current.equipment.map((e) =>
          e.behavior === 'workstation'
            ? { ...e, params: { capacity: e.params.capacity, batchSize: e.params.batchSize } }
            : e,
        ),
      }),
    );
    expect(loadProject(v3)).toEqual({ ok: true, project: current });
  });
});

describe('schema v5: saved run settings (SE-4 follow-up)', () => {
  it('accepts hours-as-seconds or shifts, and fixed or random seeds', () => {
    const p = sampleProject();
    p.run = {
      warmUp: 3600,
      length: { unit: 'seconds', value: 86400 },
      seed: { mode: 'random', value: 7 },
    };
    expect(validateProject(p).ok).toBe(true);
    p.run = {
      warmUp: 0,
      length: { unit: 'shifts', value: 3 },
      seed: { mode: 'fixed', value: 2 ** 32 - 1 },
    };
    expect(validateProject(p).ok).toBe(true);
  });

  it('rejects a negative warm-up, a zero length and out-of-range seeds', () => {
    const p = sampleProject();
    p.run = { ...p.run, warmUp: -1 };
    expectInvalid(p, 'run.warmUp');
    const q = sampleProject();
    q.run = { ...q.run, length: { unit: 'shifts', value: 0 } };
    expectInvalid(q, 'run.length.value');
    const r = sampleProject();
    r.run = { ...r.run, seed: { mode: 'fixed', value: 2 ** 32 } };
    expectInvalid(r, 'run.seed.value');
    r.run = { ...r.run, seed: { mode: 'fixed', value: 1.5 } };
    expectInvalid(r, 'run.seed.value');
  });

  it('upgrades a v4 document with the SE-4 session defaults', () => {
    const current = sampleProject();
    const { run: _run, ...rest } = current;
    const v4 = JSON.parse(JSON.stringify({ ...rest, schemaVersion: 4 }));
    expect(loadProject(v4)).toEqual({
      ok: true,
      project: { ...current, run: createProject().run },
    });
  });
});

describe('schema v6: saved minimum clearance (LE-5 follow-up)', () => {
  it('accepts a positive clearance in meters or null (off)', () => {
    const p = sampleProject();
    p.layout = { minClearance: 0.9144 };
    expect(validateProject(p).ok).toBe(true);
    p.layout = { minClearance: null };
    expect(validateProject(p).ok).toBe(true);
  });

  it('rejects a zero or negative clearance', () => {
    const p = sampleProject();
    p.layout = { minClearance: 0 };
    expectInvalid(p, 'layout.minClearance');
  });

  it('upgrades a v5 document with clearance off', () => {
    const current = sampleProject();
    const { layout: _layout, ...rest } = current;
    const v5 = JSON.parse(JSON.stringify({ ...rest, schemaVersion: 5 }));
    expect(loadProject(v5)).toEqual({
      ok: true,
      project: { ...current, layout: { minClearance: null } },
    });
  });
});

describe('schema v7: optional equipment model key (ADR-0015)', () => {
  it('upgrades a v6 document unchanged apart from the version', () => {
    const current = sampleProject();
    const v6 = JSON.parse(JSON.stringify({ ...current, schemaVersion: 6 }));
    expect(loadProject(v6)).toEqual({ ok: true, project: current });
  });

  it('keeps a model key on placed equipment through save and load', () => {
    const p = sampleProject();
    p.equipment[1] = { ...p.equipment[1]!, model: 'cnc-enclosure' };
    const result = loadProject(JSON.parse(JSON.stringify(p)));
    expect(result.ok && result.project.equipment[1]?.model).toBe('cnc-enclosure');
  });
});
