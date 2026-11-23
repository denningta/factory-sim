import { beforeEach, describe, expect, it } from 'vitest';
import type { Labor } from '@factory-sim/schema';
import { createProject, projectSchema } from '@factory-sim/schema';
import { createEditorStore } from '../layout/editorStore';
import { preRunIssues } from '../products/preRunIssues';

/** `params` is a union over behaviors; these tests only use workstations. */
const laborOf = (e: { params: object }) => (e.params as { labor: Labor }).labor;
let store: ReturnType<typeof createEditorStore>;
const s = () => store.getState();
beforeEach(() => {
  localStorage.clear();
  store = createEditorStore();
  unrouted.clear();
});

const station = (x = 2) => s().placeEquipment('base-workstation', { x, y: 2 })!;
const doc = () => ({
  ...createProject(),
  floor: s().floor,
  equipment: s().equipment,
  products: s().products,
  connections: s().connections,
  cycleTimes: s().cycleTimes,
  technicians: s().technicians,
});
const unrouted = new Set<string>();
const issues = () =>
  preRunIssues({
    // One product routed through every workstation; `unrouted` stations are left out.
    products: [
      {
        id: 'p',
        partNumber: 'P',
        name: 'P',
        color: '#000000',
        routing: s()
          .equipment.filter((e) => e.behavior === 'workstation' && !unrouted.has(e.id))
          .map((e, i) => ({ id: `step-${i}`, stationId: e.id })),
      },
    ],
    cycleTimes: [],
    equipment: s().equipment,
    technicians: s().technicians,
  }).filter((i) => i.code === 'manual_station_without_tech');

describe('TE-1 create techs with name and walk speed (default 1.2 m/s)', () => {
  it('adds a tech with a unique default name and walk speed 1.2', () => {
    const a = s().addTechnician();
    const b = s().addTechnician();
    expect(a).toMatchObject({ name: 'Tech 1', walkSpeed: 1.2, stationIds: [] });
    expect(b.name).toBe('Tech 2');
    expect(a.id).not.toBe(b.id);
    expect(projectSchema.safeParse(doc()).success).toBe(true);
  });

  it('edits name and walk speed; rejects a blank name and a non-positive speed', () => {
    const t = s().addTechnician();
    expect(s().updateTechnician(t.id, { name: 'Ana', walkSpeed: 1.5 }).ok).toBe(true);
    expect(s().technicians[0]).toMatchObject({ name: 'Ana', walkSpeed: 1.5 });
    expect(s().updateTechnician(t.id, { name: '  ' }).ok).toBe(false);
    expect(s().updateTechnician(t.id, { walkSpeed: 0 }).ok).toBe(false);
    expect(s().updateTechnician(t.id, { walkSpeed: Number.NaN }).ok).toBe(false);
    expect(s().technicians[0]).toMatchObject({ name: 'Ana', walkSpeed: 1.5 });
  });

  it('trims the name', () => {
    const t = s().addTechnician();
    s().updateTechnician(t.id, { name: '  Ana ' });
    expect(s().technicians[0]!.name).toBe('Ana');
  });

  it('is undoable, and loadDocument restores technicians', () => {
    s().addTechnician();
    s().undo();
    expect(s().technicians).toEqual([]);
    s().redo();
    expect(s().technicians).toHaveLength(1);
    const techs = [{ id: 't9', name: 'Zed', walkSpeed: 1, stationIds: [] }];
    s().loadDocument({ ...createProject(), technicians: techs });
    expect(s().technicians).toEqual(techs);
  });

  it('deleteTechnician removes the tech', () => {
    const t = s().addTechnician();
    s().deleteTechnician(t.id);
    expect(s().technicians).toEqual([]);
  });
});

describe('TE-1 assign a tech to one or more stations', () => {
  it('assigns one tech to several stations, and several techs to one station', () => {
    const a = station(2);
    const b = station(5);
    const t1 = s().addTechnician();
    const t2 = s().addTechnician();
    expect(s().setTechnicianStation(t1.id, a.id, true).ok).toBe(true);
    expect(s().setTechnicianStation(t1.id, b.id, true).ok).toBe(true);
    expect(s().setTechnicianStation(t2.id, a.id, true).ok).toBe(true);
    expect(s().technicians.map((t) => t.stationIds)).toEqual([[a.id, b.id], [a.id]]);
    expect(projectSchema.safeParse(doc()).success).toBe(true);
  });

  it('assigning twice is a no-op; unassigning removes it', () => {
    const a = station();
    const t = s().addTechnician();
    s().setTechnicianStation(t.id, a.id, true);
    s().setTechnicianStation(t.id, a.id, true);
    expect(s().technicians[0]!.stationIds).toEqual([a.id]);
    s().setTechnicianStation(t.id, a.id, false);
    expect(s().technicians[0]!.stationIds).toEqual([]);
  });

  it('rejects equipment that is not a workstation', () => {
    const buffer = s().placeEquipment('base-buffer', { x: 8, y: 2 })!;
    const t = s().addTechnician();
    expect(s().setTechnicianStation(t.id, buffer.id, true).ok).toBe(false);
    expect(s().technicians[0]!.stationIds).toEqual([]);
  });

  it('deleting a station drops it from every tech in the same undo step', () => {
    const a = station(2);
    const b = station(5);
    const t = s().addTechnician();
    s().setTechnicianStation(t.id, a.id, true);
    s().setTechnicianStation(t.id, b.id, true);
    s().selectEquipment(a.id, true);
    s().deleteSelected();
    expect(s().technicians[0]!.stationIds).toEqual([b.id]);
    expect(projectSchema.safeParse(doc()).success).toBe(true);
    s().undo();
    expect(s().technicians[0]!.stationIds).toEqual([a.id, b.id]);
  });
});

describe('TE-1 each station is manual or automatic (load/unload only)', () => {
  it('defaults to manual', () => {
    expect(laborOf(station())).toEqual({ mode: 'manual' });
  });

  it('switches to automatic with load and unload times, and back', () => {
    const a = station();
    const auto = {
      mode: 'automatic',
      loadTime: { kind: 'fixed', value: 8 },
      unloadTime: { kind: 'fixed', value: 6 },
    } as const;
    expect(s().updateEquipment(a.id, { labor: auto }).ok).toBe(true);
    expect(laborOf(s().equipment[0]!)).toEqual(auto);
    expect(projectSchema.safeParse(doc()).success).toBe(true);
    expect(s().updateEquipment(a.id, { labor: { mode: 'manual' } }).ok).toBe(true);
    expect(laborOf(s().equipment[0]!)).toEqual({ mode: 'manual' });
  });

  it('rejects a non-positive load time', () => {
    const a = station();
    const r = s().updateEquipment(a.id, {
      labor: {
        mode: 'automatic',
        loadTime: { kind: 'fixed', value: 0 },
        unloadTime: { kind: 'fixed', value: 5 },
      },
    });
    expect(r.ok).toBe(false);
    expect(laborOf(s().equipment[0]!)).toEqual({ mode: 'manual' });
  });
});

describe('TE-1 a manual station with no tech is flagged before a run', () => {
  it('does not flag a manual station that no product routes through', () => {
    const a = station();
    expect(issues()).toHaveLength(1);
    unrouted.add(a.id);
    expect(issues()).toEqual([]);
  });

  it('flags manual_station_without_tech until a tech is assigned', () => {
    const a = station();
    expect(issues()).toEqual([
      { code: 'manual_station_without_tech', message: expect.stringContaining(a.name) },
    ]);
    const t = s().addTechnician();
    s().setTechnicianStation(t.id, a.id, true);
    expect(issues()).toEqual([]);
  });

  it('does not flag an automatic station without a tech', () => {
    const a = station();
    s().updateEquipment(a.id, {
      labor: {
        mode: 'automatic',
        loadTime: { kind: 'fixed', value: 5 },
        unloadTime: { kind: 'fixed', value: 5 },
      },
    });
    expect(issues()).toEqual([]);
  });
});
