import { describe, expect, it } from 'vitest';
import { BASE_EQUIPMENT_TYPES } from '@factory-sim/schema';
import { defaultModelFor, MODELS } from './registry';
import { partBounds, partTriangles, structureKey } from './parts';
import type { ModelAnchors, ModelDefinition, ModelSize, Vec3 } from './types';

/**
 * Contract every registered model must meet (UI-7 AC7). A new model gets this for free by
 * being in the registry.
 */
const EPS = 1e-9;
const MAX_FULL_TRIANGLES = 1500;
const MAX_LOW_TRIANGLES = 200;
/** Parts are drawn 0.27 m wide; slots closer than this would overlap them. */
const MIN_SLOT_GAP = 0.3;
const DEFAULT_QUEUE_CHECK = 4;

function sizesFor(m: ModelDefinition): Record<string, ModelSize> {
  const base = BASE_EQUIPMENT_TYPES.find((t) => t.behavior === m.behaviors[0])!;
  return {
    minimum: { width: 0.1, length: 0.1, height: 0.3 },
    default: { width: base.footprint.width, length: base.footprint.length, height: base.height },
    large: { width: 10, length: 10, height: 3 },
    // Long and thin either way round (#61).
    narrow: { width: 0.2, length: 3, height: 1 },
    shallow: { width: 10, length: 0.4, height: 1 },
  };
}

const paramsFor = (m: ModelDefinition) =>
  BASE_EQUIPMENT_TYPES.find((t) => t.behavior === m.behaviors[0])!.params;

const inside = (p: Vec3, s: ModelSize) =>
  p.every(Number.isFinite) &&
  Math.abs(p[0]) <= s.width / 2 + EPS &&
  Math.abs(p[2]) <= s.length / 2 + EPS &&
  p[1] >= -EPS &&
  p[1] <= s.height + EPS;

function anchorPoints(a: ModelAnchors): [string, Vec3][] {
  const pts: [string, Vec3][] = [
    ['label', a.label],
    ['input', a.input],
    ['output', a.output],
  ];
  if (a.statusLight) pts.push(['statusLight', a.statusLight]);
  // A bench or machine's operator stands outside the footprint (SF-1); checked separately.
  if (a.operator && !a.operatorFacing) pts.push(['operator', a.operator]);
  if (a.workSurface) pts.push(['workSurface', a.workSurface]);
  a.inTray?.forEach((p, i) => pts.push([`inTray(${i})`, p]));
  a.outTray?.forEach((p, i) => pts.push([`outTray(${i})`, p]));
  for (let i = 0; i < 60; i++) pts.push([`queueSlot(${i})`, a.queueSlot(i)]);
  return pts;
}

describe.each(MODELS.map((m) => [m.id, m] as const))('UI-7 AC7: model %s', (_id, m) => {
  const sizes = sizesFor(m);
  const params = paramsFor(m);

  it('declares one LOD distance fewer than it builds levels, ascending', () => {
    const { lods } = m.build(sizes.default!, params);
    expect(lods.length).toBeGreaterThanOrEqual(2);
    expect(m.lodDistances.length).toBe(lods.length - 1);
    m.lodDistances.forEach((d, i) => {
      expect(d).toBeGreaterThan(i === 0 ? 0 : m.lodDistances[i - 1]!);
    });
  });

  it.each(Object.entries(sizes))('parts fit inside the footprint and height (%s)', (_n, s) => {
    for (const lod of m.build(s, params).lods) {
      expect(lod.length).toBeGreaterThan(0);
      const b = partBounds(lod);
      expect(b.min[0]).toBeGreaterThanOrEqual(-s.width / 2 - EPS);
      expect(b.max[0]).toBeLessThanOrEqual(s.width / 2 + EPS);
      expect(b.min[2]).toBeGreaterThanOrEqual(-s.length / 2 - EPS);
      expect(b.max[2]).toBeLessThanOrEqual(s.length / 2 + EPS);
      expect(b.min[1]).toBeGreaterThanOrEqual(-EPS);
      expect(b.max[1]).toBeLessThanOrEqual(s.height + EPS);
    }
  });

  it.each(Object.entries(sizes))('anchors lie inside the bounds (%s)', (_n, s) => {
    for (const [name, p] of anchorPoints(m.build(s, params).anchors))
      expect(inside(p, s), `${name} ${p.join(',')}`).toBe(true);
  });

  it('workstation models have a status light and an operator anchor', () => {
    if (!m.behaviors.includes('workstation')) return;
    const { anchors } = m.build(sizes.default!, params);
    expect(anchors.statusLight).toBeDefined();
    expect(anchors.operator).toBeDefined();
  });

  it.each(Object.entries(sizes))('stays within the triangle budget (%s)', (_n, s) => {
    const { lods } = m.build(s, params);
    const tris = (parts: (typeof lods)[number]) => parts.reduce((n, p) => n + partTriangles(p), 0);
    expect(tris(lods[0]!)).toBeLessThanOrEqual(MAX_FULL_TRIANGLES);
    expect(tris(lods[lods.length - 1]!)).toBeLessThanOrEqual(MAX_LOW_TRIANGLES);
  });

  it.each(Object.entries(sizes))(
    "no queue slot's resting point is inside a full-detail part, so waiting parts stay visible (%s)",
    (_n, s) => {
      const { lods, anchors } = m.build(s, params);
      for (let i = 0; i < 60; i++) {
        // A part resting on the slot fills the space just above its bottom point; a point on a
        // part's bottom face (a slot on the shelf under a crate) must count as hidden too.
        const [x, y, z] = anchors.queueSlot(i);
        const p = [x, y + 0.01, z];
        lods[0]!.forEach((part, pi) => {
          const b = partBounds([part]);
          const strictlyInside = p.every((v, k) => v > b.min[k]! + EPS && v < b.max[k]! - EPS);
          expect(strictlyInside, `queueSlot(${i}) ${p.join(',')} inside part ${pi}`).toBe(false);
        });
      }
    },
  );

  it('at default size, a full queue shows every part: the first slots are ≥ 0.3 m apart', () => {
    // Capacity for buffers; other behaviors have no queue limit, so check a short queue.
    const cap = (params as { capacity?: unknown }).capacity;
    const n = typeof cap === 'number' ? cap : DEFAULT_QUEUE_CHECK;
    const { anchors } = m.build(sizes.default!, params);
    const slots = Array.from({ length: n }, (_, i) => anchors.queueSlot(i));
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        const d = Math.hypot(...slots[i]!.map((v, k) => v - slots[j]![k]!));
        expect(d, `queueSlot(${i}) to queueSlot(${j})`).toBeGreaterThanOrEqual(MIN_SLOT_GAP - EPS);
      }
  });

  it('the same input builds the same parts and anchors', () => {
    for (const s of Object.values(sizes)) {
      const a = m.build(s, params);
      const b = m.build({ ...s }, { ...params });
      expect(b.lods).toEqual(a.lods);
      expect(anchorPoints(b.anchors)).toEqual(anchorPoints(a.anchors));
    }
  });

  it('the part structure does not depend on size, so instances can share meshes', () => {
    const keys = Object.values(sizes).map((s) =>
      m
        .build(s, params)
        .lods.map((l) => structureKey(l))
        .join('/'),
    );
    expect(new Set(keys).size).toBe(1);
  });

  it('parts carry a material role and no tone multiplier (AC2)', () => {
    for (const lod of m.build(sizes.default!, params).lods)
      for (const p of lod) {
        expect(p.role).toBeTruthy();
        expect('tone' in p).toBe(false);
      }
  });
});

describe('UI-7 AC3: fixed parts keep their real size', () => {
  const s0 = { width: 2, length: 3, height: 1.5 };
  const s1 = { width: 6, length: 9, height: 3 };

  it.each(MODELS.map((m) => [m.id, m] as const))(
    '%s: fixed parts keep their cross-section when the footprint and height grow',
    (_id, m) => {
      const params = paramsFor(m);
      const a = m.build(s0, params).lods[0]!;
      const b = m.build(s1, params).lods[0]!;
      a.forEach((p, i) => {
        if (!p.fixed) return;
        const q = b[i]!;
        expect(q.fixed).toBe(true);
        if (p.shape === 'box' && q.shape === 'box') {
          // Each side keeps its real size, unless it spans the footprint (a rail runs the
          // belt's full length), and at least one side is real.
          const keeps = (i: 0 | 2) => Math.abs(q.size[i] - p.size[i]) < 1e-9;
          const spans = (i: 0 | 2) => Math.abs(q.size[i] - (i === 0 ? s1.width : s1.length)) < 1e-9;
          expect(keeps(0) || spans(0)).toBe(true);
          expect(keeps(2) || spans(2)).toBe(true);
          expect(keeps(0) || keeps(2)).toBe(true);
        } else if (p.shape === 'cylinder' && q.shape === 'cylinder') {
          expect(q.radiusTop).toBeCloseTo(p.radiusTop, 9);
          expect(q.radiusBottom).toBeCloseTo(p.radiusBottom, 9);
        }
      });
    },
  );

  it('legs, posts, rails and the light pole are marked fixed', () => {
    for (const b of ['workstation', 'buffer', 'conveyor'] as const) {
      const m = defaultModelFor(b);
      expect(m.build(s0, paramsFor(m)).lods[0]!.some((p) => p.fixed)).toBe(true);
    }
  });
});

describe.each(['bench', 'machine'])('SF-1 AC4: workstation anchors of %s', (id) => {
  const m = MODELS.find((x) => x.id === id)!;
  const sizes = () => sizesFor(m);
  const strictlyInside = (p: Vec3, part: Parameters<typeof partBounds>[0][number]) => {
    const b = partBounds([part]);
    return p.every((v, k) => v > b.min[k]! + EPS && v < b.max[k]! - EPS);
  };

  it('is registered', () => expect(m).toBeDefined());

  it.each(Object.entries({ a: 'default', b: 'large', c: 'minimum' }))(
    'has a work surface, in and out tray slots, and an operator with a facing (%s)',
    (_k, name) => {
      const s = sizes()[name]!;
      const { anchors } = m.build(s, paramsFor(m));
      expect(anchors.workSurface).toBeDefined();
      expect(anchors.inTray!.length).toBeGreaterThan(0);
      expect(anchors.outTray!.length).toBeGreaterThan(0);
      expect(anchors.operator).toBeDefined();
      expect(anchors.operatorFacing).toBeDefined();
    },
  );

  it.each(['default', 'large', 'narrow', 'shallow', 'minimum'])(
    'work surface and tray slots are inside the bounds and not inside a part (%s)',
    (name) => {
      const s = sizes()[name]!;
      const { lods, anchors } = m.build(s, paramsFor(m));
      const slots = [...anchors.inTray!, ...anchors.outTray!];
      for (const p of [anchors.workSurface!, ...slots]) expect(inside(p, s)).toBe(true);
      for (const p of slots)
        for (const part of lods[0]!)
          expect(strictlyInside([p[0], p[1] + 0.01, p[2]], part), p.join(',')).toBe(false);
    },
  );

  it.each(['default', 'large', 'narrow', 'shallow', 'minimum'])(
    'the operator stands at the front edge outside the footprint, facing it (%s)',
    (name) => {
      const s = sizes()[name]!;
      const { lods, anchors } = m.build(s, paramsFor(m));
      const [x, y, z] = anchors.operator!;
      expect(z).toBeGreaterThan(s.length / 2);
      expect(Math.abs(x)).toBeLessThanOrEqual(s.width / 2 + EPS);
      expect(y).toBeCloseTo(0, 9);
      const [fx, fy, fz] = anchors.operatorFacing!;
      expect(fy).toBe(0);
      expect(Math.hypot(fx, fz)).toBeCloseTo(1, 9);
      expect(fz).toBeLessThan(0);
      for (const part of lods[0]!) expect(strictlyInside([x, 0.9, z], part)).toBe(false);
    },
  );
});

describe('SF-1 AC1: the bench keeps its legs, upright and light bar at real size', () => {
  it('has at least four legs, two upright posts and a light bar marked fixed', () => {
    const m = MODELS.find((x) => x.id === 'bench')!;
    const fixed = m
      .build({ width: 2, length: 1.5, height: 1.2 }, paramsFor(m))
      .lods[0]!.filter((p) => p.fixed);
    expect(fixed.length).toBeGreaterThanOrEqual(7);
  });
});
