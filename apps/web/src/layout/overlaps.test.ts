import { describe, expect, it } from 'vitest';
import { BASE_EQUIPMENT_TYPES, instantiate, type Equipment } from '@factory-sim/schema';
import { findIssues } from './overlaps';

const type = BASE_EQUIPMENT_TYPES.find((t) => t.id === 'base-workstation')!;
const box = (id: string, x: number, y: number, rotation = 0): Equipment => ({
  ...instantiate(type, { id, name: id, position: { x, y } }),
  footprint: { width: 2, length: 1 },
  rotation,
});

describe('Objects whose footprints overlap turn red', () => {
  it('flags both items of an overlapping pair', () => {
    const r = findIssues([box('a', 0, 0), box('b', 1.5, 0)], null);
    expect(r.overlaps).toEqual([['a', 'b']]);
    expect([...r.overlappingIds].sort()).toEqual(['a', 'b']);
    expect(r.count).toBe(1);
  });
  it('does not flag separated or merely touching items', () => {
    expect(findIssues([box('a', 0, 0), box('b', 5, 0)], null).count).toBe(0);
    expect(findIssues([box('a', 0, 0), box('b', 2, 0)], null).count).toBe(0);
  });
  it('respects rotation', () => {
    // a is 2 wide: a rotated 90° b (1 wide in x) at x=1.2 is clear; unrotated is not.
    expect(findIssues([box('a', 0, 0), box('b', 1.7, 0, Math.PI / 2)], null).count).toBe(0);
    expect(findIssues([box('a', 0, 0), box('b', 1.7, 0, 0)], null).count).toBe(1);
  });
  it('detects a rotated corner overlap that bounding boxes would miss', () => {
    const r = findIssues([box('a', 0, 0), box('b', 0.9, 0.9, Math.PI / 4)], null);
    expect(r.overlaps.length).toBe(1);
  });
});

describe('Optional minimum clearance distance also flags too-close objects', () => {
  const pair = [box('a', 0, 0), box('b', 2.5, 0)]; // 0.5 m gap
  it('flags a gap below the clearance but not overlapping', () => {
    const r = findIssues(pair, 1);
    expect(r.tooClose).toEqual([['a', 'b']]);
    expect(r.overlaps).toEqual([]);
    expect(r.tooCloseIds.has('a')).toBe(true);
    expect(r.count).toBe(1);
  });
  it('does nothing when clearance is off or satisfied', () => {
    expect(findIssues(pair, null).count).toBe(0);
    expect(findIssues(pair, 0.5).count).toBe(0);
  });
  it('counts an overlapping pair once, as an overlap', () => {
    const r = findIssues([box('a', 0, 0), box('b', 1, 0)], 1);
    expect(r.overlaps.length).toBe(1);
    expect(r.tooClose.length).toBe(0);
    expect(r.count).toBe(1);
  });
});
