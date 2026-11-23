import { describe, expect, it } from 'vitest';
import { BASE_EQUIPMENT_TYPES, instantiate, type Connection } from '@factory-sim/schema';
import { reachableFrom, reachableFromSources, type FlowGraph } from './reachability';

const type = (behavior: string) => BASE_EQUIPMENT_TYPES.find((t) => t.behavior === behavior)!;
const eq = (id: string, behavior: string) =>
  instantiate(type(behavior), { id, position: { x: 1, y: 1 } });
const link = (from: string, to: string): Connection => ({
  id: `cn-${from}-${to}`,
  from: { equipmentId: from, portId: 'out' },
  to: { equipmentId: to, portId: 'in' },
  capacity: 0,
  transfer: { kind: 'instant' },
});

describe('PR-2 steps whose station is unreachable by connections are flagged', () => {
  it('a station downstream of a source is reachable; an unconnected one is not', () => {
    const g: FlowGraph = {
      equipment: [eq('src', 'source'), eq('s1', 'workstation'), eq('s2', 'workstation')],
      connections: [link('src', 's1')],
    };
    const r = reachableFromSources(g);
    expect(r.has('s1')).toBe(true);
    expect(r.has('s2')).toBe(false);
  });

  it('follows connections through buffers and conveyors, several hops deep', () => {
    const g: FlowGraph = {
      equipment: [
        eq('src', 'source'),
        eq('b', 'buffer'),
        eq('c', 'conveyor'),
        eq('s1', 'workstation'),
        eq('snk', 'sink'),
      ],
      connections: [link('src', 'b'), link('b', 'c'), link('c', 's1'), link('s1', 'snk')],
    };
    expect([...reachableFromSources(g)].sort()).toEqual(['b', 'c', 'snk', 'src', 's1'].sort());
  });

  it('respects direction: feeding a reachable station does not make you reachable', () => {
    const g: FlowGraph = {
      equipment: [eq('src', 'source'), eq('s1', 'workstation'), eq('s2', 'workstation')],
      connections: [link('src', 's1'), link('s2', 's1')],
    };
    expect(reachableFromSources(g).has('s2')).toBe(false);
  });

  it('an island of connected stations with no source is unreachable', () => {
    const g: FlowGraph = {
      equipment: [eq('src', 'source'), eq('s1', 'workstation'), eq('s2', 'workstation')],
      connections: [link('s1', 's2'), link('s2', 's1')],
    };
    const r = reachableFromSources(g);
    expect(r.has('s1')).toBe(false);
    expect(r.has('s2')).toBe(false);
  });

  it('with no source nothing is reachable', () => {
    const g: FlowGraph = { equipment: [eq('s1', 'workstation')], connections: [] };
    expect(reachableFromSources(g).size).toBe(0);
  });

  it('handles loops (rework) without hanging', () => {
    const g: FlowGraph = {
      equipment: [eq('src', 'source'), eq('s1', 'workstation'), eq('s2', 'workstation')],
      connections: [link('src', 's1'), link('s1', 's2'), link('s2', 's1')],
    };
    expect(reachableFromSources(g).has('s2')).toBe(true);
  });

  it('reachableFrom starts anywhere (for routing between steps, FL-3)', () => {
    const g: FlowGraph = {
      equipment: [eq('s1', 'workstation'), eq('s2', 'workstation'), eq('s3', 'workstation')],
      connections: [link('s1', 's2')],
    };
    expect([...reachableFrom(g, ['s1'])].sort()).toEqual(['s1', 's2']);
  });
});
