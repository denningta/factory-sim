import type { Equipment, Port } from '@factory-sim/schema';

/** World (plan, meters) position of a port: instance position + rotation of (u·width, v·length). */
export function portWorldPosition(
  e: Pick<Equipment, 'position' | 'rotation' | 'footprint'>,
  port: Pick<Port, 'u' | 'v'>,
): { x: number; y: number } {
  const dx = port.u * e.footprint.width;
  const dy = port.v * e.footprint.length;
  const cos = Math.cos(e.rotation);
  const sin = Math.sin(e.rotation);
  return { x: e.position.x + dx * cos - dy * sin, y: e.position.y + dx * sin + dy * cos };
}
