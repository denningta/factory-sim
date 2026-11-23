import { describe, expect, it } from 'vitest';
import { createProject } from '@factory-sim/schema';
import { documentForSave } from './document';

describe('documentForSave (schema v4 adoption)', () => {
  it('keeps the calendar and saves demand and release (PR-4)', () => {
    const base = {
      ...createProject(),
      calendar: { shiftLength: 10 * 3600 },
      demand: { basis: 'perShift' as const, items: [] },
      release: {
        interval: { kind: 'exponential' as const, mean: 45 },
        product: { kind: 'random' as const },
      },
    };
    const { floor, equipment, products, connections, cycleTimes, technicians, demand, release } =
      createProject();
    const saved = documentForSave(base, {
      floor: { ...floor, width: 50 },
      equipment,
      products,
      connections,
      cycleTimes,
      technicians,
      demand,
      release,
    });
    expect(saved.floor.width).toBe(50);
    expect(saved.calendar).toEqual(base.calendar);
    expect(saved.demand).toEqual(demand);
    expect(saved.release).toEqual(release);
  });

  it('saves the technicians slice (TE-1)', () => {
    const technicians = [{ id: 't1', name: 'Tech 1', walkSpeed: 1.2, stationIds: [] }];
    const { floor, equipment, products, connections, cycleTimes, demand, release } =
      createProject();
    const saved = documentForSave(createProject(), {
      floor,
      equipment,
      products,
      connections,
      cycleTimes,
      technicians,
      demand,
      release,
    });
    expect(saved.technicians).toEqual(technicians);
  });
});
