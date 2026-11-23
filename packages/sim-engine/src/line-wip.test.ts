import { describe, expect, it } from 'vitest';
import { compileLine, createRun, type LineEvent, type PartInLine } from './index';
import { fixed, lineProject } from './line-fixture';

function newRun() {
  const c = compileLine(
    lineProject({
      products: ['A'],
      stations: [
        { id: 'S1', cycle: { A: fixed(10) } },
        { id: 'S2', cycle: { A: fixed(20) } },
      ],
      interval: fixed(5),
    }),
  );
  if (!c.ok) throw new Error(JSON.stringify(c.issues));
  return createRun(c.model, { seed: 1, warmUp: 0, runLength: 3600 });
}

/** The wip a consumer would rebuild by replaying every event. */
function replay(events: LineEvent[]): PartInLine[] {
  const live = new Map<number, PartInLine>();
  for (const e of events) {
    if (e.type === 'partReleased')
      live.set(e.partId, { partId: e.partId, productId: e.productId, releasedAt: e.t, last: e });
    else if (e.type === 'partExited') live.delete(e.partId);
    else if (e.type === 'partMoved' || e.type === 'partEntered' || e.type === 'partStarted') {
      const p = live.get(e.partId);
      if (p) p.last = e;
    }
  }
  return [...live.values()].sort((a, b) => a.partId - b.partId);
}

describe('SE-3 AC3: Run.wip() lists the parts in the line', () => {
  it('matches replaying the events, with events on', () => {
    const r = newRun();
    r.runUntil(137);
    expect(r.wip()).toEqual(replay(r.drainEvents()));
    expect(r.wip().length).toBeGreaterThan(2);
  });

  it('is identical with events off, and sorted by partId', () => {
    const on = newRun();
    on.runUntil(137);
    const off = newRun();
    off.drainEvents(); // the t = 0 events recorded at creation
    off.setEventsEnabled(false);
    off.runUntil(137);
    expect(off.drainEvents()).toEqual([]);
    expect(off.wip()).toEqual(on.wip());
    const ids = off.wip().map((p) => p.partId);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
  });

  it('count equals released minus exited', () => {
    const r = newRun();
    r.setEventsEnabled(false);
    r.runUntil(500);
    const { total } = r.stats();
    expect(r.wip().length).toBe(total.released - total.completed);
  });
});
