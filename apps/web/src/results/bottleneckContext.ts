import type { Connection } from '@factory-sim/schema';

export interface BottleneckContext {
  /** Stations upstream of the bottleneck that are blocked more than 50% of the window. */
  blockedUpstream: string[];
  /** Stations downstream that are starved more than 50% of the window. */
  starvedDownstream: string[];
}

/** Everything reachable from `start` following connections forward or backward (buffers included). */
function reach(connections: readonly Connection[], start: string, dir: 'up' | 'down'): Set<string> {
  const seen = new Set<string>();
  const queue = [start];
  while (queue.length) {
    const at = queue.pop()!;
    for (const c of connections) {
      const [here, next] = dir === 'down' ? [c.from, c.to] : [c.to, c.from];
      if (here.equipmentId === at && !seen.has(next.equipmentId)) {
        seen.add(next.equipmentId);
        queue.push(next.equipmentId);
      }
    }
  }
  return seen;
}

/** "Mostly" is more than half of the measured window (fractions 0–1), in row order. */
export function bottleneckContext(
  connections: readonly Connection[],
  rows: readonly { id: string; blocked: number; starved: number }[],
  bottleneckId: string,
): BottleneckContext {
  const up = reach(connections, bottleneckId, 'up');
  const down = reach(connections, bottleneckId, 'down');
  return {
    blockedUpstream: rows.filter((r) => up.has(r.id) && r.blocked > 0.5).map((r) => r.id),
    starvedDownstream: rows.filter((r) => down.has(r.id) && r.starved > 0.5).map((r) => r.id),
  };
}
