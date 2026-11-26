import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  ARC_CLEARANCE,
  arcPath,
  buildArcs,
  connectionAtVertex,
  paintArcs,
  type ArcInput,
} from './connectionArcs';

const input = (id: string, x0: number, x1: number, h0 = 1, h1 = 2): ArcInput => ({
  id,
  from: { x: x0, y: h0 + 0.1, z: 0 },
  to: { x: x1, y: h1 + 0.1, z: 0 },
  top: Math.max(h0, h1) + ARC_CLEARANCE,
});

describe('SF-3 AC1: arcs above the equipment', () => {
  it('starts at the output port, ends at the input port and peaks about 0.5 m over the taller station', () => {
    const pts = arcPath(input('a', 0, 6, 1, 2));
    expect(pts[0]!.distanceTo(new THREE.Vector3(0, 1.1, 0))).toBeLessThan(1e-6);
    expect(pts[pts.length - 1]!.distanceTo(new THREE.Vector3(6, 2.1, 0))).toBeLessThan(1e-6);
    const peak = Math.max(...pts.map((p) => p.y));
    expect(peak).toBeGreaterThan(2.4);
    expect(peak).toBeLessThan(2.7);
  });

  it('rises first: the point after the start is higher than the start', () => {
    const pts = arcPath(input('a', 0, 6));
    expect(pts[1]!.y).toBeGreaterThan(pts[0]!.y);
  });

  it('has a direction marker: the arrowhead sits at the destination end of the geometry', () => {
    const { geometry, ranges } = buildArcs([input('a', 0, 6)]);
    const pos = geometry.getAttribute('position');
    const r = ranges[0]!;
    // The last vertex of the range belongs to the cone head, whose tip touches the input port.
    let nearEnd = 0;
    for (let i = r.start; i < r.start + r.count; i++) if (pos.getX(i) > 5.5) nearEnd++;
    expect(nearEnd).toBeGreaterThan(0);
  });
});

describe('SF-3 AC5: draw calls do not grow per connection', () => {
  it('any number of connections is one geometry with a vertex range each', () => {
    const many = buildArcs(Array.from({ length: 30 }, (_, i) => input(`c${i}`, i, i + 5)));
    expect(many.geometry).toBeInstanceOf(THREE.BufferGeometry);
    expect(many.ranges).toHaveLength(30);
    expect(many.geometry.getAttribute('position').count).toBe(
      many.ranges.reduce((n, r) => n + r.count, 0),
    );
  });

  it('empty input gives an empty geometry, not a throw', () => {
    expect(buildArcs([]).ranges).toEqual([]);
  });
});

describe('SF-3 AC2: picking and colour', () => {
  it('maps a vertex back to its connection', () => {
    const { ranges } = buildArcs([input('a', 0, 6), input('b', 10, 16)]);
    expect(connectionAtVertex(ranges, ranges[0]!.start + 3)).toBe('a');
    expect(connectionAtVertex(ranges, ranges[1]!.start + 3)).toBe('b');
    expect(connectionAtVertex(ranges, 1e9)).toBeNull();
  });

  it('paintArcs colours one connection without touching the other, and reports a change', () => {
    const { geometry, ranges } = buildArcs([input('a', 0, 6), input('b', 10, 16)]);
    const colors = new Map([
      ['a', { color: '#ff0000', flowing: false }],
      ['b', { color: '#00ff00', flowing: true }],
    ]);
    expect(paintArcs(geometry, ranges, colors)).toBe(true);
    const c = geometry.getAttribute('color');
    expect(new THREE.Color().fromBufferAttribute(c, ranges[0]!.start).getHexString()).toBe(
      'ff0000',
    );
    expect(c.getW(ranges[0]!.start)).toBe(0);
    expect(new THREE.Color().fromBufferAttribute(c, ranges[1]!.start).getHexString()).toBe(
      '00ff00',
    );
    expect(c.getW(ranges[1]!.start)).toBe(1);
    expect(paintArcs(geometry, ranges, colors)).toBe(false);
  });
});
