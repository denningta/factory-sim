import { beforeEach, describe, expect, it } from 'vitest';
import { BASE_EQUIPMENT_TYPES, defaultPorts, type EquipmentType } from '@factory-sim/schema';
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
    expect(store.getState().syncInstancesToType(edited)).toBe(1);
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
});
