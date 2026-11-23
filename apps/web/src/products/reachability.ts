import type { Project } from '@factory-sim/schema';

export type FlowGraph = Pick<Project, 'equipment' | 'connections'>;

/** Equipment ids that material can reach by following connections from any of `starts`. */
export function reachableFrom(_graph: FlowGraph, _starts: Iterable<string>): Set<string> {
  throw new Error('not implemented');
}

/** Equipment ids material released by a source can reach (sources included). */
export function reachableFromSources(_graph: FlowGraph): Set<string> {
  throw new Error('not implemented');
}
