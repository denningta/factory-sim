import type { Port } from '@factory-sim/schema';

export type PortSide = 'back' | 'front' | 'left' | 'right';

export function portSide(_port: Pick<Port, 'u' | 'v'>): PortSide {
  throw new Error('not implemented');
}

/** Fraction −0.5…0.5 along the edge of the given side. */
export function portAt(_side: PortSide, _offset: number): Pick<Port, 'u' | 'v'> {
  throw new Error('not implemented');
}
