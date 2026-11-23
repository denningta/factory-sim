import { describe, expect, it } from 'vitest';
import type { Simulation } from './api';
import { createSimulation } from './simulation';

/**
 * FL-2 two-station model, built only on the kernel API: S1 → connection(capacity) → S2.
 * Connection capacity: positive integer = finite buffer (a Queue), Infinity = unlimited,
 * 0 = no buffer: S1 holds its finished part (blocked) until S2 takes it directly.
 * S1 has an endless supply, so any idle time of S1 is blocking and any idle time of S2 is
 * starving.
 */
function run(opts: { c1: number; c2: number; capacity: number; horizon: number }) {
  const sim: Simulation = createSimulation({ seed: 1 });
  const buffer = opts.capacity > 0 ? sim.createQueue<number>('link', opts.capacity) : undefined;
  let s1BlockedSince: number | undefined;
  let s2StarvedSince: number | undefined = 0;
  let s1Blocked = 0;
  let s2Starved = 0;
  let done = 0;
  let nextPart = 0;
  // Direct hand-off (capacity 0): at most one of these is set at a time.
  let heldBy1: { part: number; release: () => void } | undefined;
  let s2WaitingForHandoff: ((part: number) => void) | undefined;

  const s2Start = (_part: number) => {
    if (s2StarvedSince !== undefined) s2Starved += sim.now - s2StarvedSince;
    s2StarvedSince = undefined;
    sim.schedule(opts.c2, () => {
      done++;
      s2Take();
    });
  };
  const s2Take = () => {
    s2StarvedSince ??= sim.now; // idle until a part is in hand
    if (buffer) {
      buffer.get((part) => s2Start(part));
      return;
    }
    if (heldBy1) {
      const { part, release } = heldBy1;
      heldBy1 = undefined;
      release();
      s2Start(part);
    } else {
      s2WaitingForHandoff = s2Start;
    }
  };
  const s1Make = () => {
    const part = nextPart++;
    sim.schedule(opts.c1, () => {
      const unblock = () => {
        if (s1BlockedSince !== undefined) s1Blocked += sim.now - s1BlockedSince;
        s1BlockedSince = undefined;
        s1Make();
      };
      if (buffer) {
        s1BlockedSince = buffer.length >= buffer.capacity ? sim.now : undefined;
        buffer.put(part, unblock);
      } else if (s2WaitingForHandoff) {
        const start = s2WaitingForHandoff;
        s2WaitingForHandoff = undefined;
        start(part);
        unblock();
      } else {
        s1BlockedSince = sim.now;
        heldBy1 = { part, release: unblock };
      }
    });
  };

  s1Make();
  s2Take();
  sim.runUntil(opts.horizon);
  // Close any open intervals at the horizon.
  if (s1BlockedSince !== undefined) s1Blocked += sim.now - s1BlockedSince;
  if (s2StarvedSince !== undefined) s2Starved += sim.now - s2StarvedSince;
  return { done, s1Blocked, s2Starved, bufferLength: buffer?.length ?? 0 };
}

describe('FL-2: connection capacity blocks and starves stations', () => {
  it('a full buffer blocks the upstream station (slow downstream, capacity 2)', () => {
    const r = run({ c1: 1, c2: 3, capacity: 2, horizon: 300 });
    expect(r.bufferLength).toBe(2); // full
    expect(r.s1Blocked).toBeGreaterThan(190); // S1 waits of the run
    expect(r.s2Starved).toBeLessThanOrEqual(1); // only the initial wait for the first part
    expect(r.done).toBeGreaterThanOrEqual(99); // throughput set by S2 (1 per 3 s)
    expect(r.done).toBeLessThanOrEqual(100);
  });

  it('an empty buffer starves the downstream station (slow upstream, capacity 2)', () => {
    const r = run({ c1: 3, c2: 1, capacity: 2, horizon: 300 });
    expect(r.bufferLength).toBe(0);
    expect(r.s1Blocked).toBe(0);
    expect(r.s2Starved).toBeGreaterThan(190); // S2 idle about 2 s of every 3 s
    expect(r.done).toBeGreaterThanOrEqual(98); // throughput set by S1
    expect(r.done).toBeLessThanOrEqual(100);
  });

  it('capacity 0 (no buffer) blocks upstream until downstream takes the part directly', () => {
    const r = run({ c1: 1, c2: 3, capacity: 0, horizon: 300 });
    expect(r.s1Blocked).toBeGreaterThan(190);
    expect(r.s2Starved).toBeLessThanOrEqual(1);
    expect(r.done).toBeGreaterThanOrEqual(98);
    expect(r.done).toBeLessThanOrEqual(100);
  });

  it('a bigger buffer delays blocking but cannot raise the bottleneck throughput', () => {
    const small = run({ c1: 1, c2: 3, capacity: 1, horizon: 300 });
    const big = run({ c1: 1, c2: 3, capacity: 50, horizon: 300 });
    expect(big.s1Blocked).toBeLessThan(small.s1Blocked);
    expect(big.done).toBeLessThanOrEqual(small.done + 1);
  });

  it('an unlimited connection never blocks the upstream station', () => {
    const r = run({ c1: 1, c2: 3, capacity: Infinity, horizon: 300 });
    expect(r.s1Blocked).toBe(0);
    expect(r.bufferLength).toBeGreaterThan(150); // work in process piles up
  });
});
