import type { Project } from '@factory-sim/schema';

export type FlowGraph = Pick<Project, 'equipment' | 'connections'>;

/**
 * Equipment ids that material can reach by following connections from any of `starts`
 * (the starts included). A part entering equipment can leave by any of its output ports, so
 * the port graph collapses to equipment → equipment edges.
 */
export function reachableFrom(graph: FlowGraph, starts: Iterable<string>): Set<string> {
  const next = new Map<string, string[]>();
  for (const c of graph.connections) {
    const list = next.get(c.from.equipmentId) ?? [];
    list.push(c.to.equipmentId);
    next.set(c.from.equipmentId, list);
  }
  const seen = new Set(starts);
  const queue = [...seen];
  for (let id = queue.pop(); id !== undefined; id = queue.pop()) {
    for (const to of next.get(id) ?? []) {
      if (seen.has(to)) continue;
      seen.add(to);
      queue.push(to);
    }
  }
  return seen;
}

/** Equipment ids material released by a source can reach (sources included). */
export function reachableFromSources(graph: FlowGraph): Set<string> {
  const sources = graph.equipment.filter((e) => e.behavior === 'source').map((e) => e.id);
  return reachableFrom(graph, sources);
}
