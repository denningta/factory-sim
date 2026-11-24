import { describe, expect, it } from 'vitest';
import { portAt, portSide } from './portSides';

describe('port sides', () => {
  it('AC1: a port maps to the footprint side it sits on', () => {
    expect(portSide({ u: 0, v: -0.5 })).toBe('back');
    expect(portSide({ u: 0.2, v: 0.5 })).toBe('front');
    expect(portSide({ u: -0.5, v: 0 })).toBe('left');
    expect(portSide({ u: 0.5, v: -0.1 })).toBe('right');
  });

  it('AC1: a side and offset along its edge give back a port on the footprint edge', () => {
    expect(portAt('back', 0)).toEqual({ u: 0, v: -0.5 });
    expect(portAt('front', 0.25)).toEqual({ u: 0.25, v: 0.5 });
    expect(portAt('left', -0.25)).toEqual({ u: -0.5, v: -0.25 });
    expect(portAt('right', 0)).toEqual({ u: 0.5, v: 0 });
  });
});
