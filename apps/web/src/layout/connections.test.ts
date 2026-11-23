import { beforeEach, describe, expect, it } from 'vitest';
import { createProject, validateProject } from '@factory-sim/schema';
import { createEditorStore } from './editorStore';

let store: ReturnType<typeof createEditorStore>;
let a: string;
let b: string;
const out = (equipmentId: string) => ({ equipmentId, portId: 'out' });
const inp = (equipmentId: string) => ({ equipmentId, portId: 'in' });

beforeEach(() => {
  localStorage.clear();
  store = createEditorStore();
  a = store.getState().placeEquipment('workstation', { x: 5, y: 5 })!.id;
  b = store.getState().placeEquipment('workstation', { x: 10, y: 5 })!.id;
});

describe('FL-1 connections', () => {
  it('click an output, then an input, to create a connection', () => {
    expect(store.getState().clickPort(out(a))).toEqual({ ok: true });
    expect(store.getState().pendingFrom).toEqual(out(a));
    expect(store.getState().connections).toHaveLength(0);
    expect(store.getState().clickPort(inp(b))).toEqual({ ok: true });
    const [c] = store.getState().connections;
    expect(c).toMatchObject({ from: out(a), to: inp(b), capacity: 0 });
    expect(store.getState().pendingFrom).toBeNull();
  });

  it('creates a document the schema accepts', () => {
    store.getState().connect(out(a), inp(b));
    const { floor, equipment, connections } = store.getState();
    expect(validateProject({ ...createProject(), floor, equipment, connections }).ok).toBe(true);
  });

  it('a first click on an input does not start a connection', () => {
    expect(store.getState().clickPort(inp(a)).ok).toBe(false);
    expect(store.getState().pendingFrom).toBeNull();
  });

  it('a connection cannot link an object to itself', () => {
    store.getState().clickPort(out(a));
    const r = store.getState().clickPort(inp(a));
    expect(r.ok).toBe(false);
    expect(store.getState().connections).toHaveLength(0);
    expect(store.getState().connect(out(a), inp(a)).ok).toBe(false);
  });

  it('rejects a duplicate connection', () => {
    store.getState().connect(out(a), inp(b));
    expect(store.getState().connect(out(a), inp(b)).ok).toBe(false);
    expect(store.getState().connections).toHaveLength(1);
  });

  it('connections can be selected and deleted', () => {
    store.getState().connect(out(a), inp(b));
    const id = store.getState().connections[0]!.id;
    store.getState().selectConnection(id);
    expect(store.getState().selectedConnectionId).toBe(id);
    store.getState().deleteSelected();
    expect(store.getState().connections).toHaveLength(0);
    expect(store.getState().selectedConnectionId).toBeNull();
    expect(store.getState().equipment).toHaveLength(2);
  });

  it('deleting equipment removes its connections', () => {
    store.getState().connect(out(a), inp(b));
    store.getState().selectEquipment(a, false);
    store.getState().deleteSelected();
    expect(store.getState().connections).toHaveLength(0);
  });

  it('connect and delete are undoable', () => {
    store.getState().connect(out(a), inp(b));
    store.getState().undo();
    expect(store.getState().connections).toHaveLength(0);
    store.getState().redo();
    expect(store.getState().connections).toHaveLength(1);
    store.getState().selectConnection(store.getState().connections[0]!.id);
    store.getState().deleteSelected();
    store.getState().undo();
    expect(store.getState().connections).toHaveLength(1);
  });

  it('loadDocument loads connections and clears pending state', () => {
    store.getState().connect(out(a), inp(b));
    const { floor, equipment, connections } = store.getState();
    const again = createEditorStore();
    again.getState().loadDocument({ ...createProject(), floor, equipment, connections });
    expect(again.getState().connections).toEqual(connections);
  });
});
