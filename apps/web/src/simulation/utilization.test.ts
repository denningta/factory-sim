import { describe, expect, it } from 'vitest';
import type { RunStats } from '@factory-sim/sim-engine';
import { projectSchema } from '@factory-sim/schema';
import { sortRows, stationUtilization, techUtilization } from './utilization';
import { createRunSession } from './runSession';
import modelJson from '../../../../docs/reference-model/model.json';

const stats = (): RunStats => ({
  window: { from: 0, to: 100 },
  byProduct: {},
  total: { released: 0, completed: 0, throughputPerHour: 0, averageWip: 0, averageLeadTime: NaN },
  stations: {
    s1: { working: 0.5, starved: 0.25, blocked: 0.125, idle: 0.125 },
    s2: { working: 0.8, starved: 0, blocked: 0, idle: 0.2 },
  },
  techs: { t1: { working: 0.6, walking: 0.1, idle: 0.3 } },
});
const stations = [
  { id: 's1', name: 'Weld' },
  { id: 's2', name: 'Cut' },
];

describe('AN-2 AC1: station time split into working, starved, blocked and idle %', () => {
  it('gives each station’s four states as percentages, named, in the given order', () => {
    const rows = stationUtilization(stats(), stations);
    expect(rows).toEqual([
      { id: 's1', name: 'Weld', working: 50, starved: 25, blocked: 12.5, idle: 12.5 },
      { id: 's2', name: 'Cut', working: 80, starved: 0, blocked: 0, idle: 20 },
    ]);
  });

  it('sums to 100% per station on the reference model run', () => {
    const project = projectSchema.parse(modelJson);
    const r = createRunSession(project, { seed: 1, warmUp: 3600, runLength: 8 * 3600 });
    if (!r.ok) throw new Error(JSON.stringify(r.issues));
    r.session.runToEnd();
    for (let i = 0; i < 100000 && !r.session.done; i++) r.session.frame(1000);
    const names = project.equipment.map((e) => ({ id: e.id, name: e.name }));
    const rows = stationUtilization(r.session.stats(), names);
    expect(rows.length).toBeGreaterThanOrEqual(5);
    for (const row of rows) {
      expect(row.working + row.starved + row.blocked + row.idle).toBeCloseTo(100, 6);
    }
  });
});

describe('AN-2 AC2: tech time split into working, walking and idle %', () => {
  it('gives each tech’s three states as percentages', () => {
    const rows = techUtilization(stats(), [{ id: 't1', name: 'Tech 1' }]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ name: 'Tech 1', working: 60, idle: 30 });
    expect(rows[0]!.walking).toBeCloseTo(10, 9);
  });
});

describe('AN-2 AC3: sortable', () => {
  const rows = () => stationUtilization(stats(), stations);
  it('sorts by a state column ascending and descending', () => {
    expect(sortRows(rows(), { key: 'working', dir: 'desc' }).map((r) => r.id)).toEqual([
      's2',
      's1',
    ]);
    expect(sortRows(rows(), { key: 'working', dir: 'asc' }).map((r) => r.id)).toEqual(['s1', 's2']);
  });
  it('sorts by name and does not mutate its input', () => {
    const r = rows();
    expect(sortRows(r, { key: 'name', dir: 'asc' }).map((x) => x.name)).toEqual(['Cut', 'Weld']);
    expect(r.map((x) => x.id)).toEqual(['s1', 's2']);
  });
});
