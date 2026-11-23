import { describe, expect, it } from 'vitest';
import { portWorldPosition } from './ports';

const e = { position: { x: 10, y: 5 }, rotation: 0, footprint: { width: 2, length: 4 } };

describe('portWorldPosition', () => {
  it('places an unrotated port at position + (u·width, v·length)', () => {
    expect(portWorldPosition(e, { u: 0, v: 0.5 })).toEqual({ x: 10, y: 7 });
    expect(portWorldPosition(e, { u: 0.5, v: -0.5 })).toEqual({ x: 11, y: 3 });
  });

  it('rotates the offset by the instance rotation (plan angle runs x→y)', () => {
    const p = portWorldPosition({ ...e, rotation: Math.PI / 2 }, { u: 0, v: 0.5 });
    expect(p.x).toBeCloseTo(8, 10);
    expect(p.y).toBeCloseTo(5, 10);
  });
});
