import { describe, expect, it } from 'vitest';
import { partBounds } from '../equipment/models/parts';
import { defaultModelFor } from '../equipment/models/registry';
import {
  drawCalls,
  groupEquipment,
  lodForDistance,
  partScale,
  splitByLod,
  unitGeometryArgs,
} from './equipmentGroups';
import { createEditorStore } from './editorStore';

describe('Clearance checks (LE-5) use the real footprint', () => {
  it('a resized instance is rendered and picked from its own footprint, not its type default', () => {
    const store = createEditorStore();
    const a = store.getState().placeEquipment('base-workstation', { x: 2, y: 2 })!;
    const b = store.getState().placeEquipment('base-workstation', { x: 8, y: 8 })!;
    expect(
      store.getState().updateEquipment(b.id, { footprint: { width: 4, length: 3 }, height: 2 }).ok,
    ).toBe(true);
    const groups = groupEquipment(store.getState().equipment);
    expect(groups).toHaveLength(1);
    const g = groups[0]!;
    const ia = g.items.findIndex((i) => i.id === a.id);
    const ib = g.items.findIndex((i) => i.id === b.id);
    const bb = partBounds(g.itemLods[ib]![0]!);
    expect(bb.max[0]! - bb.min[0]!).toBeCloseTo(4, 9);
    expect(bb.max[2]! - bb.min[2]!).toBeCloseTo(3, 9);
    expect(bb.max[1]).toBeCloseTo(2, 9);
    const ba = partBounds(g.itemLods[ia]![0]!);
    expect(ba.max[0]! - ba.min[0]!).toBeCloseTo(2, 9);
  });

  it('instances with identical settings share one group', () => {
    const store = createEditorStore();
    store.getState().placeEquipment('base-workstation', { x: 2, y: 2 });
    store.getState().placeEquipment('base-workstation', { x: 8, y: 8 });
    expect(groupEquipment(store.getState().equipment)).toHaveLength(1);
  });

  it('same-size instances with different colors share one group and keep their own color', () => {
    const store = createEditorStore();
    store.getState().placeEquipment('base-workstation', { x: 2, y: 2 });
    store.getState().placeEquipment('base-workstation', { x: 8, y: 8 });
    const [a, b] = store.getState().equipment;
    const groups = groupEquipment([a!, { ...b!, color: '#ff0000' }]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.items.map((i) => i.color)).toEqual([a!.color, '#ff0000']);
  });
});

describe('EQ-5: draw calls per equipment type, not per size', () => {
  const place = (n: number, typeId = 'base-workstation') => {
    const store = createEditorStore();
    store.getState().setFloor({ width: 200, length: 200 });
    for (let i = 0; i < n; i++) {
      const e = store
        .getState()
        .placeEquipment(typeId, { x: 3 + (i % 5) * 6, y: 3 + Math.floor(i / 5) * 6 })!;
      store.getState().updateEquipment(e.id, {
        footprint: { width: 1 + i * 0.1, length: 1 + i * 0.2 },
        height: 1 + i * 0.05,
      });
    }
    return store.getState().equipment;
  };

  it('one InstancedMesh set per type: N instances in N sizes give a constant draw-call count', () => {
    const counts = [1, 5, 20].map((n) => drawCalls(groupEquipment(place(n))));
    expect(new Set(counts).size).toBe(1);
    expect(groupEquipment(place(20))).toHaveLength(1);
  });

  it('two types of many sizes cost one set each', () => {
    const store = createEditorStore();
    store.getState().setFloor({ width: 200, length: 200 });
    for (const t of ['base-workstation', 'base-buffer'])
      for (let i = 0; i < 6; i++) {
        const e = store
          .getState()
          .placeEquipment(t, { x: 3 + i * 6, y: t === 'base-buffer' ? 12 : 3 })!;
        store.getState().updateEquipment(e.id, { footprint: { width: 1 + i * 0.3, length: 1.5 } });
      }
    const groups = groupEquipment(store.getState().equipment);
    expect(groups).toHaveLength(2);
    const meshes = (g: (typeof groups)[number]) => g.lods.reduce((n, l) => n + l.length, 0);
    expect(drawCalls(groups)).toBe(meshes(groups[0]!) + meshes(groups[1]!));
  });

  it('size is encoded in the instance transform, and each part keeps its own absolute size', () => {
    const eq = place(3);
    const g = groupEquipment(eq)[0]!;
    g.itemLods.forEach((lods) =>
      lods[0]!.forEach((p, pi) => {
        const s = partScale(p);
        if (p.shape === 'box') expect(s).toEqual(p.size);
        else expect(s).toEqual([p.radiusBottom, p.height, p.radiusBottom]);
        expect(p.shape).toBe(g.lods[0]![pi]!.shape);
      }),
    );
    // The cabinet stretches with each instance; the signal tower (fixed) keeps its radius.
    expect(partScale(g.itemLods[0]![0]![0]!)).not.toEqual(partScale(g.itemLods[2]![0]![0]!));
    expect(partScale(g.itemLods[0]![0]![2]!)[0]).toBeCloseTo(
      partScale(g.itemLods[2]![0]![2]!)[0],
      9,
    );
  });

  it('N instances in N colors give a constant draw-call count', () => {
    const counts = [1, 5, 12].map((n) => {
      const eq = place(n).map((e, i) => ({
        ...e,
        color: `#${(i * 20 + 16).toString(16).padStart(2, '0')}3366`,
      }));
      const groups = groupEquipment(eq);
      expect(groups).toHaveLength(1);
      return drawCalls(groups);
    });
    expect(new Set(counts).size).toBe(1);
  });

  it('unit geometry scaled by partScale reproduces every part exactly', () => {
    for (const t of [
      'base-workstation',
      'base-buffer',
      'base-conveyor',
      'base-source',
      'base-sink',
    ]) {
      const g = groupEquipment(place(3, t))[0]!;
      for (const parts of g.itemLods.flat())
        parts.forEach((p) => {
          const u = unitGeometryArgs(p);
          const s = partScale(p);
          expect(u.shape).toBe(p.shape);
          if (p.shape === 'box') expect(u.args.map((a, i) => a * s[i]!)).toEqual([...p.size]);
          else {
            expect(u.args[0]! * s[0]).toBeCloseTo(p.radiusTop, 9);
            expect(u.args[1]! * s[0]).toBeCloseTo(p.radiusBottom, 9);
            expect(u.args[2]! * s[1]).toBeCloseTo(p.height, 9);
          }
        });
    }
  });
});

describe('UI-7 AC5: instancing groups are keyed by (model, LOD)', () => {
  it('types that resolve to the same model share one group', () => {
    const store = createEditorStore();
    const a = store.getState().placeEquipment('base-workstation', { x: 2, y: 2 })!;
    const b = store.getState().placeEquipment('base-workstation', { x: 8, y: 8 })!;
    // Another type, and an id the registry doesn't know: both draw the default model.
    const other = { ...b, typeId: 'user-cnc', model: 'no-such-model' };
    const groups = groupEquipment([a, other]);
    expect(groups).toHaveLength(1);
    expect(groups[0]!.model).toBe(defaultModelFor('workstation'));
    expect(groups[0]!.key).toContain(defaultModelFor('workstation').id);
  });

  it('a group holds every LOD level of its model, per item', () => {
    const store = createEditorStore();
    store.getState().placeEquipment('base-buffer', { x: 2, y: 2 });
    store.getState().placeEquipment('base-buffer', { x: 6, y: 2 });
    const [g] = groupEquipment(store.getState().equipment);
    const levels = g!.model.lodDistances.length + 1;
    expect(g!.lods).toHaveLength(levels);
    for (const lods of g!.itemLods) {
      expect(lods).toHaveLength(levels);
      lods.forEach((parts, l) => expect(parts).toHaveLength(g!.lods[l]!.length));
    }
  });

  it('picks the LOD by camera distance', () => {
    expect(lodForDistance([30, 80], 5)).toBe(0);
    expect(lodForDistance([30, 80], 30)).toBe(0);
    expect(lodForDistance([30, 80], 31)).toBe(1);
    expect(lodForDistance([30, 80], 500)).toBe(2);
    expect(lodForDistance([], 500)).toBe(0);
  });

  it('splits a group into per-LOD instance lists, in item order', () => {
    const lod = [0, 1, 1, 0, 1];
    expect(splitByLod(lod.length, (i) => lod[i]!, 2)).toEqual([
      [0, 3],
      [1, 2, 4],
    ]);
  });
});
