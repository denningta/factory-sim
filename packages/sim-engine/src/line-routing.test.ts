import { describe, expect, it } from 'vitest';
import { compileLine, createRun } from './index';
import { fixed, lineProject } from './line-fixture';

/** FL-3: parts follow their product's routing where flow splits. */

/** src → S1 → {S2 (product A), S3 (product B)} → sink, built by rewiring a straight line. */
function splitProject() {
  const p = lineProject({
    products: ['A', 'B'],
    stations: [
      { id: 'S1', cycle: { A: fixed(5), B: fixed(5) } },
      { id: 'S2', cycle: { A: fixed(5) } },
      { id: 'S3', cycle: { B: fixed(5) } },
    ],
    interval: fixed(20),
  });
  const link = (id: string, from: string, to: string) => ({
    id,
    from: { equipmentId: from, portId: 'out' },
    to: { equipmentId: to, portId: 'in' },
    capacity: null,
    transfer: { kind: 'instant' as const },
  });
  p.connections = [
    link('c0', 'src', 'S1'),
    link('c1', 'S1', 'S2'),
    link('c2', 'S1', 'S3'),
    link('c3', 'S2', 'sink'),
    link('c4', 'S3', 'sink'),
  ];
  return p;
}

describe('FL-3 routing at splits', () => {
  it('At a station with several outgoing connections, each part takes the path to its next routing step', () => {
    const c = compileLine(splitProject());
    if (!c.ok) throw new Error(JSON.stringify(c.issues));
    const r = createRun(c.model, { seed: 1, warmUp: 0, runLength: 3600 });
    r.runUntil(r.endTime);
    const events = r.drainEvents();
    const product = new Map<number, string>();
    const visited = new Map<number, string[]>();
    for (const e of events) {
      if (e.type === 'partReleased') product.set(e.partId, e.productId);
      if (e.type === 'partStarted')
        visited.set(e.partId, [...(visited.get(e.partId) ?? []), e.equipmentId]);
    }
    const stations = new Set<string>();
    for (const [id, path] of visited) {
      if (path.length < 2) continue; // still in flight at the end
      expect(path, `part ${id}`).toEqual(product.get(id) === 'A' ? ['S1', 'S2'] : ['S1', 'S3']);
      stations.add(path[1]!);
    }
    expect([...stations].sort()).toEqual(['S2', 'S3']);
  });

  it('If no path exists, the run is blocked with a clear validation error', () => {
    const p = splitProject();
    p.connections = p.connections.filter((x) => x.id !== 'c2'); // S1 → S3 removed
    const c = compileLine(p);
    expect(c.ok).toBe(false);
    if (c.ok) return;
    expect(c.issues).toEqual([
      expect.objectContaining({ code: 'no_path', objectId: 'B-S3', severity: 'error' }),
    ]);
    expect(c.issues[0]!.message).toMatch(/B can't reach/);
  });
});
