import type { Connection, Equipment, Port } from '@factory-sim/schema';

/** World (plan, meters) position of a port: instance position + rotation of (u·width, v·length). */
export function portWorldPosition(
  e: Pick<Equipment, 'position' | 'rotation' | 'footprint'>,
  port: Pick<Port, 'u' | 'v'>,
): { x: number; y: number } {
  return localToPlan(e, port.u * e.footprint.width, port.v * e.footprint.length);
}

/** Plan point of a point in the equipment's own frame (m: x across the width, z along the length). */
export function localToPlan(
  e: Pick<Equipment, 'position' | 'rotation'>,
  x: number,
  z: number,
): { x: number; y: number } {
  const cos = Math.cos(e.rotation);
  const sin = Math.sin(e.rotation);
  return { x: e.position.x + x * cos - z * sin, y: e.position.y + x * sin + z * cos };
}

/**
 * What the connection layer draws during a drag: the equipment preview moves imperatively, so
 * ports and arrows of moving items are left out until the drop rather than left behind.
 */
export function hideDragged(
  equipment: readonly Equipment[],
  connections: readonly Connection[],
  draggingIds: readonly string[],
): { equipment: Equipment[]; connections: Connection[] } {
  if (draggingIds.length === 0) return { equipment: [...equipment], connections: [...connections] };
  const moving = new Set(draggingIds);
  return {
    equipment: equipment.filter((e) => !moving.has(e.id)),
    connections: connections.filter(
      (c) => !moving.has(c.from.equipmentId) && !moving.has(c.to.equipmentId),
    ),
  };
}
