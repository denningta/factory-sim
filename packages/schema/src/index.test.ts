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
    schemaVersion: CURRENT_SCHEMA_VERSION,
    floor: { width: 30, length: 20, gridSpacing: 1 },
    equipment: [
      eq('src', 'source', 1),
      eq('s1', 'workstation', 5),
      eq('s2', 'workstation', 10),
      eq('snk', 'sink', 15),
    ],
    connections: [
      { id: 'c1', from: 'src', to: 's1' },
      { id: 'c2', from: 's1', to: 's2' },
      { id: 'c3', from: 's2', to: 'snk' },
    ],
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
    p.cycleTimes[0]!.time.value = -1;
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
    p.connections.push({ id: 'c4', from: 's1', to: 's1' });
    expectInvalid(p, 'connections[3]', 'cannot connect "s1" to itself');
  });

  it('rejects references to unknown equipment', () => {
    const p = sampleProject();
    p.connections[0]!.to = 'ghost';
    p.products[0]!.routing[0]!.stationId = 'nowhere';
    expectInvalid(
      p,
      'connections[0].to',
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
