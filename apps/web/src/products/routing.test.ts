import { beforeEach, describe, expect, it } from 'vitest';
import { createProject, validateProject, type Equipment } from '@factory-sim/schema';
import { createEditorStore } from '../layout/editorStore';

let store: ReturnType<typeof createEditorStore>;
let s1: Equipment;
let s2: Equipment;
let s3: Equipment;
let buffer: Equipment;
beforeEach(() => {
  localStorage.clear();
  store = createEditorStore();
  const place = (typeId: string, x: number) =>
    store.getState().placeEquipment(typeId, { x, y: 2 })!;
  s1 = place('base-workstation', 2);
  s2 = place('base-workstation', 5);
  s3 = place('base-workstation', 8);
  buffer = place('base-buffer', 11);
});

const routing = (productId: string) =>
  store.getState().products.find((p) => p.id === productId)!.routing;
const stations = (productId: string) => routing(productId).map((s) => s.stationId);
const documentIsValid = () =>
  validateProject({
    ...createProject(),
    floor: store.getState().floor,
    equipment: store.getState().equipment,
    products: store.getState().products,
  }).ok;

describe('PR-2 add, reorder and remove routing steps, each assigned to a station', () => {
  it('adds steps in order, each pointing at its station', () => {
    const a = store.getState().addProduct();
    for (const s of [s1, s2, s3]) expect(store.getState().addRoutingStep(a.id, s.id).ok).toBe(true);
    expect(stations(a.id)).toEqual([s1.id, s2.id, s3.id]);
    expect(new Set(routing(a.id).map((s) => s.id)).size).toBe(3);
    expect(documentIsValid()).toBe(true);
  });

  it('rejects a step at equipment that is not a workstation, or does not exist', () => {
    const a = store.getState().addProduct();
    expect(store.getState().addRoutingStep(a.id, buffer.id)).toMatchObject({ ok: false });
    expect(store.getState().addRoutingStep(a.id, 'nope')).toMatchObject({ ok: false });
    expect(routing(a.id)).toEqual([]);
  });

  it('step ids never collide with other ids in the document', () => {
    const a = store.getState().addProduct();
    const b = store.getState().addProduct();
    store.getState().addRoutingStep(a.id, s1.id);
    store.getState().addRoutingStep(b.id, s1.id);
    store.getState().removeRoutingStep(a.id, routing(a.id)[0]!.id);
    store.getState().addRoutingStep(b.id, s2.id);
    store.getState().addRoutingStep(a.id, s2.id);
    expect(documentIsValid()).toBe(true);
  });

  it('reassigns a step to another workstation, but not to a buffer', () => {
    const a = store.getState().addProduct();
    const step = (store.getState().addRoutingStep(a.id, s1.id) as { step: { id: string } }).step;
    expect(store.getState().setRoutingStepStation(a.id, step.id, s3.id).ok).toBe(true);
    expect(stations(a.id)).toEqual([s3.id]);
    expect(store.getState().setRoutingStepStation(a.id, step.id, buffer.id).ok).toBe(false);
    expect(stations(a.id)).toEqual([s3.id]);
  });

  it('moves a step to a new position', () => {
    const a = store.getState().addProduct();
    for (const s of [s1, s2, s3]) store.getState().addRoutingStep(a.id, s.id);
    const last = routing(a.id)[2]!.id;
    store.getState().moveRoutingStep(a.id, last, 0);
    expect(stations(a.id)).toEqual([s3.id, s1.id, s2.id]);
    store.getState().moveRoutingStep(a.id, last, 99);
    expect(stations(a.id)).toEqual([s1.id, s2.id, s3.id]);
  });

  it('removes a step and keeps the others in order', () => {
    const a = store.getState().addProduct();
    for (const s of [s1, s2, s3]) store.getState().addRoutingStep(a.id, s.id);
    store.getState().removeRoutingStep(a.id, routing(a.id)[1]!.id);
    expect(stations(a.id)).toEqual([s1.id, s3.id]);
  });

  it('each routing edit is one undo step', () => {
    const a = store.getState().addProduct();
    store.getState().addRoutingStep(a.id, s1.id);
    store.getState().addRoutingStep(a.id, s2.id);
    store.getState().moveRoutingStep(a.id, routing(a.id)[1]!.id, 0);
    store.getState().removeRoutingStep(a.id, routing(a.id)[0]!.id);
    expect(stations(a.id)).toEqual([s1.id]);
    store.getState().undo();
    expect(stations(a.id)).toEqual([s2.id, s1.id]);
    store.getState().undo();
    expect(stations(a.id)).toEqual([s1.id, s2.id]);
    store.getState().undo();
    expect(stations(a.id)).toEqual([s1.id]);
  });

  it('a move that changes nothing leaves no undo step', () => {
    const a = store.getState().addProduct();
    store.getState().addRoutingStep(a.id, s1.id);
    store.getState().moveRoutingStep(a.id, routing(a.id)[0]!.id, 0);
    store.getState().undo();
    expect(routing(a.id)).toEqual([]);
  });

  it('deleting a station removes the steps that used it, in the same undo step', () => {
    const a = store.getState().addProduct();
    store.getState().addRoutingStep(a.id, s1.id);
    store.getState().addRoutingStep(a.id, s2.id);
    store.getState().selectEquipment(s1.id, false);
    store.getState().deleteSelected();
    expect(stations(a.id)).toEqual([s2.id]);
    expect(documentIsValid()).toBe(true);
    store.getState().undo();
    expect(stations(a.id)).toEqual([s1.id, s2.id]);
    expect(store.getState().equipment.some((e) => e.id === s1.id)).toBe(true);
  });

  it('loadDocument loads routings and connections', () => {
    const a = store.getState().addProduct();
    store.getState().addRoutingStep(a.id, s1.id);
    const doc = {
      ...createProject(),
      equipment: store.getState().equipment,
      products: store.getState().products,
      connections: [
        {
          id: 'cn-1',
          from: { equipmentId: s1.id, portId: 'out' },
          to: { equipmentId: s2.id, portId: 'in' },
          capacity: 0,
          transfer: { kind: 'instant' as const },
        },
      ],
    };
    const other = createEditorStore();
    other.getState().loadDocument(doc);
    expect(other.getState().products[0]!.routing).toEqual(routing(a.id));
    expect(other.getState().connections).toEqual(doc.connections);
  });
});

describe('PR-2 the same station can appear in many products’ routings', () => {
  it('two products route through the same station', () => {
    const a = store.getState().addProduct();
    const b = store.getState().addProduct();
    expect(store.getState().addRoutingStep(a.id, s1.id).ok).toBe(true);
    expect(store.getState().addRoutingStep(a.id, s2.id).ok).toBe(true);
    expect(store.getState().addRoutingStep(b.id, s1.id).ok).toBe(true);
    expect(store.getState().addRoutingStep(b.id, s3.id).ok).toBe(true);
    expect(stations(a.id)).toEqual([s1.id, s2.id]);
    expect(stations(b.id)).toEqual([s1.id, s3.id]);
    expect(documentIsValid()).toBe(true);
  });

  it('editing one product’s routing leaves the other’s alone', () => {
    const a = store.getState().addProduct();
    const b = store.getState().addProduct();
    store.getState().addRoutingStep(a.id, s1.id);
    store.getState().addRoutingStep(b.id, s1.id);
    store.getState().removeRoutingStep(a.id, routing(a.id)[0]!.id);
    expect(stations(b.id)).toEqual([s1.id]);
  });
});
