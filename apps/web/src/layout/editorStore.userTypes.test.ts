import { beforeEach, describe, expect, it } from 'vitest';
import {
  BASE_EQUIPMENT_TYPES,
  createProject,
  defaultPorts,
  instantiate,
  projectSchema,
  type EquipmentType,
} from '@factory-sim/schema';
import { createEditorStore } from './editorStore';

const cnc: EquipmentType = {
  id: '11111111-1111-4111-8111-111111111111',
  name: '5-axis CNC',
  behavior: 'workstation',
  params: { capacity: 1, batchSize: 1, labor: { mode: 'manual' } },
  footprint: { width: 3, length: 2.5 },
  height: 2.4,
  color: '#2f6f9f',
  ports: defaultPorts('workstation'),
};

let store: ReturnType<typeof createEditorStore>;
beforeEach(() => {
  localStorage.clear();
  store = createEditorStore();
  store.getState().setUserTypes([cnc]);
});

describe('user equipment types in the editor store (EQ-3)', () => {
  it('AC2: a user type can be placed like a built-in and copies its settings', () => {
    const placed = store.getState().placeEquipment(cnc.id, { x: 5, y: 5 });
    expect(placed).toMatchObject({
      typeId: cnc.id,
      name: '5-axis CNC 1',
      behavior: 'workstation',
      height: 2.4,
      color: '#2f6f9f',
      footprint: { width: 3, length: 2.5 },
    });
  });

  it('AC2: built-ins still place when user types exist', () => {
    expect(store.getState().placeEquipment(BASE_EQUIPMENT_TYPES[0]!.id, { x: 5, y: 5 })).not.toBe(
      null,
    );
  });

  it('AC3: editing the type leaves placed instances with their own settings', () => {
    const placed = store.getState().placeEquipment(cnc.id, { x: 5, y: 5 })!;
    store.getState().updateEquipment(placed.id, { height: 3 });
    store.getState().setUserTypes([{ ...cnc, height: 4, color: '#ff0000' }]);
    expect(store.getState().equipment[0]).toMatchObject({ height: 3, color: '#2f6f9f' });
  });

  it('AC3: accepting the offer copies the new settings to instances of that type only', () => {
    const a = store.getState().placeEquipment(cnc.id, { x: 5, y: 5 })!;
    const other = store.getState().placeEquipment(BASE_EQUIPMENT_TYPES[1]!.id, { x: 9, y: 9 })!;
    store.getState().updateEquipment(a.id, { name: 'Mill A', position: { x: 6 } });
    const edited: EquipmentType = {
      ...cnc,
      height: 4,
      color: '#ff0000',
      footprint: { width: 4, length: 3 },
    };
    expect(store.getState().syncInstancesToType(edited)).toEqual({ ok: true, count: 1 });
    const [synced, untouched] = store.getState().equipment;
    expect(synced).toMatchObject({
      id: a.id,
      name: 'Mill A',
      position: { x: 6, y: 5 },
      height: 4,
      color: '#ff0000',
      footprint: { width: 4, length: 3 },
    });
    expect(untouched).toEqual(other);
  });

  it('AC3: updating instances is one undo step', () => {
    store.getState().placeEquipment(cnc.id, { x: 5, y: 5 });
    store.getState().syncInstancesToType({ ...cnc, height: 4 });
    store.getState().undo();
    expect(store.getState().equipment[0]!.height).toBe(2.4);
  });

  it('AC3: keeps the instance’s own labor when the type stays a workstation', () => {
    const placed = store.getState().placeEquipment(cnc.id, { x: 5, y: 5 })!;
    const labor = {
      mode: 'automatic',
      loadTime: { kind: 'fixed', value: 5 },
      unloadTime: { kind: 'fixed', value: 5 },
    };
    store.getState().updateEquipment(placed.id, { labor } as never);
    store.getState().syncInstancesToType({ ...cnc, height: 4 });
    expect(store.getState().equipment[0]).toMatchObject({ height: 4, params: { labor } });
  });

  describe('AC3: accepting the offer never produces a project that cannot save', () => {
    function loadLine() {
      const a = instantiate(cnc, { id: 'eq-1', position: { x: 5, y: 5 } });
      const b = instantiate(BASE_EQUIPMENT_TYPES[0]!, { id: 'eq-2', position: { x: 9, y: 5 } });
      store.getState().loadDocument({
        ...createProject(),
        equipment: [a, b],
        connections: [
          {
            id: 'c-1',
            from: { equipmentId: 'eq-1', portId: 'out' },
            to: { equipmentId: 'eq-2', portId: 'in' },
            capacity: 0,
            transfer: { kind: 'instant' },
          },
        ],
        products: [
          {
            id: 'p-1',
            partNumber: 'A',
            name: 'A',
            color: '#112233',
            routing: [{ id: 's-1', stationId: 'eq-1' }],
          },
        ],
        cycleTimes: [{ productId: 'p-1', stationId: 'eq-1', time: { kind: 'fixed', value: 10 } }],
      } as never);
      store.getState().setUserTypes([cnc]);
    }
    const asBehavior = (behavior: 'source' | 'sink'): EquipmentType =>
      ({ ...cnc, behavior, params: {}, ports: defaultPorts(behavior) }) as EquipmentType;
    const current = () => {
      const s = store.getState();
      return projectSchema.safeParse({
        ...createProject(),
        floor: s.floor,
        equipment: s.equipment,
        products: s.products,
        connections: s.connections,
        cycleTimes: s.cycleTimes,
        technicians: s.technicians,
        demand: s.demand,
        release: s.release,
      });
    };

    it.each(['source', 'sink'] as const)(
      'refuses a change to %s and leaves everything as is',
      (b) => {
        loadLine();
        const before = store.getState().equipment;
        const r = store.getState().syncInstancesToType(asBehavior(b));
        expect(r.ok).toBe(false);
        if (!r.ok) expect(r.error.length).toBeGreaterThan(0);
        expect(store.getState().equipment).toBe(before);
        expect(current().success).toBe(true);
        store.getState().undo();
        expect(store.getState().equipment).toBe(before); // no stray undo step was recorded
      },
    );

    it('still updates when the new behavior keeps every reference valid', () => {
      loadLine();
      const r = store.getState().syncInstancesToType({ ...cnc, height: 4 });
      expect(r).toEqual({ ok: true, count: 1 });
      expect(current().success).toBe(true);
    });
  });
});
