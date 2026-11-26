import { describe, expect, it } from 'vitest';
import type { Connection } from '@factory-sim/schema';
import { bottleneckContext } from './bottleneckContext';

const conn = (from: string, to: string): Connection => ({
  id: `${from}-${to}`,
  from: { equipmentId: from, portId: 'out' },
  to: { equipmentId: to, portId: 'in' },
  capacity: 0,
  transfer: { kind: 'instant' },
});
// a → buf → b → c → d, with a side branch a → e
const connections = [
  conn('a', 'buf'),
  conn('buf', 'b'),
  conn('b', 'c'),
  conn('c', 'd'),
  conn('a', 'e'),
];
const r = (id: string, blocked: number, starved: number) => ({ id, blocked, starved });

describe('UI-6 AC4: bottleneck context', () => {
  it('lists upstream stations blocked and downstream stations starved for more than 50%', () => {
    const ctx = bottleneckContext(
      connections,
      [r('a', 0.8, 0), r('b', 0.1, 0), r('c', 0, 0.9), r('d', 0, 0.7), r('e', 0.9, 0)],
      'b',
    );
    // e is not upstream of b through any path; a is, through the buffer.
    expect(ctx.blockedUpstream).toEqual(['a']);
    expect(ctx.starvedDownstream).toEqual(['c', 'd']);
  });

  it('"mostly" means strictly more than 50%', () => {
    const ctx = bottleneckContext(connections, [r('a', 0.5, 0), r('c', 0, 0.5), r('b', 0, 0)], 'b');
    expect(ctx.blockedUpstream).toEqual([]);
    expect(ctx.starvedDownstream).toEqual([]);
  });
});
