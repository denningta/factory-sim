import { describe, expect, it } from 'vitest';
import { createProject } from '@factory-sim/schema';
import { documentForSave } from './document';

describe('documentForSave (schema v4 adoption)', () => {
  it('keeps sections the editor does not manage (calendar, demand, release, technicians)', () => {
    const base = {
      ...createProject(),
      calendar: { shiftLength: 10 * 3600 },
      demand: { basis: 'perShift' as const, items: [] },
      release: {
        interval: { kind: 'exponential' as const, mean: 45 },
        product: { kind: 'random' as const },
      },
      technicians: [{ id: 't1', name: 'Tech 1', walkSpeed: 1.2, stationIds: [] }],
    };
    const { floor, equipment, products, connections, cycleTimes } = createProject();
    const saved = documentForSave(base, {
      floor: { ...floor, width: 50 },
      equipment,
      products,
      connections,
      cycleTimes,
    });
    expect(saved.floor.width).toBe(50);
    expect(saved.calendar).toEqual(base.calendar);
    expect(saved.demand).toEqual(base.demand);
    expect(saved.release).toEqual(base.release);
    expect(saved.technicians).toEqual(base.technicians);
  });
});
