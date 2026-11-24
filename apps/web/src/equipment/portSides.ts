import type { Port } from '@factory-sim/schema';

/** Footprint sides: material flows along the length, so back/front are its two ends. */
export type PortSide = 'back' | 'front' | 'left' | 'right';

export const PORT_SIDES: readonly PortSide[] = ['back', 'front', 'left', 'right'];

export function portSide(port: Pick<Port, 'u' | 'v'>): PortSide {
  if (port.v === -0.5) return 'back';
  if (port.v === 0.5) return 'front';
  return port.u < 0 ? 'left' : 'right';
}

/** `offset` is the fraction (−0.5…0.5) along the edge of the given side. */
export function portAt(side: PortSide, offset: number): Pick<Port, 'u' | 'v'> {
  switch (side) {
    case 'back':
      return { u: offset, v: -0.5 };
    case 'front':
      return { u: offset, v: 0.5 };
    case 'left':
      return { u: -0.5, v: offset };
    case 'right':
      return { u: 0.5, v: offset };
  }
}

/** The offset along the edge of the port's side. */
export function portOffset(port: Pick<Port, 'u' | 'v'>): number {
  return portSide(port) === 'back' || portSide(port) === 'front' ? port.u : port.v;
}
