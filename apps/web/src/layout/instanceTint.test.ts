import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { instanceTint } from './instanceTint';

const base = new THREE.Color('#9ca3af');
const none = { overlapping: false, tooClose: false, selected: false };
const redness = (c: THREE.Color) => c.r - Math.max(c.g, c.b);

describe('Objects whose footprints overlap turn red (instance color)', () => {
  it('leaves unflagged items unchanged', () => {
    expect(instanceTint(base, none).equals(base)).toBe(true);
  });
  it('overlap is strongly red; too-close is a lighter red', () => {
    const o = instanceTint(base, { ...none, overlapping: true });
    const t = instanceTint(base, { ...none, tooClose: true });
    expect(redness(o)).toBeGreaterThan(0.5);
    expect(redness(t)).toBeGreaterThan(0.1);
    expect(redness(o)).toBeGreaterThan(redness(t));
  });
  it('a selected flagged item stays red', () => {
    const c = instanceTint(base, { overlapping: true, tooClose: false, selected: true });
    expect(redness(c)).toBeGreaterThan(0.2);
  });
});
