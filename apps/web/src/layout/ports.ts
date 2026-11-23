import type { Equipment, Port } from '@factory-sim/schema';

/** World (plan, meters) position of a port: instance position + rotation of (u·width, v·length). */
export function portWorldPosition(
  _e: Pick<Equipment, 'position' | 'rotation' | 'footprint'>,
  _port: Pick<Port, 'u' | 'v'>,
): { x: number; y: number } {
  throw new Error('not implemented');
}
