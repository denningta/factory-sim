import type { Connection } from '@factory-sim/schema';

export interface BottleneckContext {
  /** Stations upstream of the bottleneck that are blocked more than 50% of the window. */
  blockedUpstream: string[];
  /** Stations downstream that are starved more than 50% of the window. */
  starvedDownstream: string[];
}

export function bottleneckContext(
  _connections: readonly Connection[],
  _rows: readonly { id: string; blocked: number; starved: number }[],
  _bottleneckId: string,
): BottleneckContext {
  throw new Error('not implemented');
}
