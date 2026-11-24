import { describe, expect, it } from 'vitest';
import type { Entity } from './api';
import { createSimulation } from './simulation';

const newSim = () => createSimulation({ seed: 1 });

describe('event calendar', () => {
  it('runs events in time order and advances the clock', () => {
    const sim = newSim();
    const log: string[] = [];
    sim.schedule(5, () => log.push(`b@${sim.now}`));
    sim.schedule(1, () => log.push(`a@${sim.now}`));
    sim.schedule(9, () => log.push(`c@${sim.now}`));
    expect(sim.pendingEvents).toBe(3);
    sim.runUntil(100);
    expect(log).toEqual(['a@1', 'b@5', 'c@9']);
    expect(sim.now).toBe(100);
    expect(sim.pendingEvents).toBe(0);
  });

  it('breaks ties by priority, then schedule order (FIFO)', () => {
    const sim = newSim();
    const log: string[] = [];
    sim.schedule(2, () => log.push('p0-first'));
    sim.schedule(2, () => log.push('p1'), 1);
    sim.schedule(2, () => log.push('p-1'), -1);
    sim.schedule(2, () => log.push('p0-second'));
    for (let i = 0; i < 20; i++) sim.schedule(3, () => log.push(`f${i}`));
    sim.runUntil(3);
    expect(log).toEqual([
      'p-1',
      'p0-first',
      'p0-second',
      'p1',
      ...Array.from({ length: 20 }, (_, i) => `f${i}`),
    ]);
  });

  it('step() runs one event and returns false when the calendar is empty', () => {
    const sim = newSim();
    let ran = 0;
    sim.schedule(4, () => ran++);
    expect(sim.step()).toBe(true);
    expect(sim.now).toBe(4);
    expect(ran).toBe(1);
    expect(sim.step()).toBe(false);
  });

  it('runUntil includes events scheduled at the end time while running, and stops before later ones', () => {
    const sim = newSim();
    const log: number[] = [];
    sim.schedule(10, () => {
      log.push(sim.now);
      sim.schedule(0, () => log.push(sim.now));
      sim.schedule(0.5, () => log.push(sim.now));
    });
    sim.runUntil(10);
    expect(log).toEqual([10, 10]);
    expect(sim.pendingEvents).toBe(1);
    sim.runUntil(10.5);
    expect(log).toEqual([10, 10, 10.5]);
  });

  it('cancelled events never run and do not count as pending', () => {
    const sim = newSim();
    let ran = false;
    const h = sim.schedule(3, () => (ran = true));
    expect(h.time).toBe(3);
    sim.schedule(5, () => undefined);
    h.cancel();
    h.cancel();
    expect(sim.pendingEvents).toBe(1);
    sim.runUntil(10);
    expect(ran).toBe(false);
    const done = sim.schedule(1, () => undefined);
    sim.runUntil(11);
    done.cancel(); // no-op after it ran
    expect(sim.pendingEvents).toBe(0);
    // step() skips cancelled events
    sim.schedule(1, () => undefined).cancel();
    expect(sim.step()).toBe(false);
  });

  it('throws on misuse: bad delays, bad priority, running into the past or from inside an event', () => {
    const sim = newSim();
    expect(() => sim.schedule(-1, () => undefined)).toThrow();
    expect(() => sim.schedule(NaN, () => undefined)).toThrow();
    expect(() => sim.schedule(Infinity, () => undefined)).toThrow();
    expect(() => sim.schedule(1, () => undefined, NaN)).toThrow();
    sim.runUntil(5);
    expect(() => sim.runUntil(4)).toThrow();
    expect(() => sim.runUntil(NaN)).toThrow();
    expect(() => sim.runUntil(Infinity)).toThrow();
    const errors: unknown[] = [];
    sim.schedule(1, () => {
      for (const f of [() => sim.step(), () => sim.runUntil(100)]) {
        try {
          f();
        } catch (e) {
          errors.push(e);
        }
      }
    });
    sim.runUntil(10);
    expect(errors).toHaveLength(2);
  });

  it('stays usable after an event throws', () => {
    const sim = newSim();
    sim.schedule(1, () => {
      throw new Error('boom');
    });
    sim.schedule(2, () => undefined);
    expect(() => sim.runUntil(5)).toThrow('boom');
    expect(() => sim.runUntil(5)).not.toThrow();
  });

  it('validates the seed', () => {
    expect(() => createSimulation({ seed: 0.5 })).toThrow();
    expect(createSimulation({ seed: -1 }).rng.next()).toBe(
      createSimulation({ seed: 0xffffffff }).rng.next(),
    );
  });
});

describe('entities (parts)', () => {
  it('get sequential ids from 1, a creation time and the given data', () => {
    const sim = newSim();
    const a = sim.createEntity({ product: 'A' });
    sim.schedule(2.5, () => undefined);
    sim.runUntil(2.5);
    const b = sim.createEntity({ product: 'B' });
    expect(a).toEqual({ id: 1, createdAt: 0, product: 'A' });
    expect(b).toEqual({ id: 2, createdAt: 2.5, product: 'B' });
    expect(createSimulation({ seed: 1 }).createEntity({}).id).toBe(1);
  });

  it('reject id or createdAt in data', () => {
    const sim = newSim();
    // @ts-expect-error -- the type forbids it; check the runtime guard too
    expect(() => sim.createEntity({ id: 5 })).toThrow();
    // @ts-expect-error -- as above
    expect(() => sim.createEntity({ createdAt: 5 })).toThrow();
  });
});

describe('resources (stations, technicians)', () => {
  it('grant up to capacity as zero-delay events and queue the rest FIFO', () => {
    const sim = newSim();
    const station = sim.createResource('weld', 2);
    expect(station.name).toBe('weld');
    expect(station.capacity).toBe(2);
    const parts = [1, 2, 3, 4].map(() => sim.createEntity({}));
    const granted: number[] = [];
    for (const p of parts) station.request(p, () => granted.push(p.id));
    expect(granted).toEqual([]); // never inside request()
    expect(station.inUse).toBe(2); // reserved at decision time
    expect(station.queueLength).toBe(2);
    sim.runUntil(0);
    expect(granted).toEqual([1, 2]);
    station.release(parts[1]!);
    expect(granted).toEqual([1, 2]); // never inside release()
    expect(station.inUse).toBe(2);
    expect(station.queueLength).toBe(1);
    sim.runUntil(0);
    expect(granted).toEqual([1, 2, 3]);
    station.release(parts[0]!);
    station.release(parts[2]!);
    sim.runUntil(0);
    expect(granted).toEqual([1, 2, 3, 4]);
    station.release(parts[3]!);
    expect(station.inUse).toBe(0);
  });

  it('lets one entity hold several units and throws when releasing a unit not held', () => {
    const sim = newSim();
    const r = sim.createResource('tech', 2);
    const e = sim.createEntity({});
    r.request(e, () => undefined);
    r.request(e, () => undefined);
    expect(r.inUse).toBe(2);
    r.release(e);
    r.release(e);
    expect(() => r.release(e)).toThrow();
    expect(() => r.release(sim.createEntity({}))).toThrow();
  });

  it('cancel() withdraws a waiting request (true) but not a granted one (false)', () => {
    const sim = newSim();
    const tech = sim.createResource('tech', 1);
    const [a, b, c] = [sim.createEntity({}), sim.createEntity({}), sim.createEntity({})];
    const granted: number[] = [];
    const ha = tech.request(a, () => granted.push(a.id));
    const hb = tech.request(b, () => granted.push(b.id));
    tech.request(c, () => granted.push(c.id));
    expect(ha.cancel()).toBe(false); // granted (callback pending): caller owns the unit
    expect(hb.cancel()).toBe(true);
    expect(hb.cancel()).toBe(true); // still withdrawn
    expect(tech.queueLength).toBe(1);
    sim.runUntil(0);
    tech.release(a);
    sim.runUntil(0);
    expect(granted).toEqual([1, 3]);
  });

  it('report time-weighted utilization and queue length, reset by resetStatistics()', () => {
    const sim = newSim();
    const r = sim.createResource('m', 2);
    const es = [1, 2, 3].map(() => sim.createEntity({}));
    expect(r.utilization()).toBe(0);
    expect(r.averageQueueLength()).toBe(0);
    for (const e of es) r.request(e, () => undefined); // 2 busy, 1 waiting
    sim.runUntil(10);
    r.release(es[0]!); // 2 busy (3rd granted), 0 waiting
    sim.runUntil(20);
    r.release(es[1]!);
    r.release(es[2]!);
    sim.runUntil(40);
    expect(r.utilization()).toBeCloseTo((2 * 20) / 2 / 40, 12);
    expect(r.averageQueueLength()).toBeCloseTo(10 / 40, 12);
    sim.resetStatistics();
    expect(r.utilization()).toBe(0);
    r.request(es[0]!, () => undefined);
    sim.runUntil(50);
    expect(r.utilization()).toBeCloseTo(0.5, 12);
  });

  it('reject a non-positive or fractional capacity', () => {
    const sim = newSim();
    for (const c of [0, -1, 1.5, Infinity, NaN]) expect(() => sim.createResource('x', c)).toThrow();
  });
});

describe('queues (buffers)', () => {
  it('store items FIFO and hand them to getters as events', () => {
    const sim = newSim();
    const q = sim.createQueue<string>('buf');
    expect(q.capacity).toBe(Infinity);
    expect(q.name).toBe('buf');
    const log: string[] = [];
    q.put('a', () => log.push('stored a'));
    q.put('b', () => log.push('stored b'));
    expect(q.length).toBe(2);
    expect(log).toEqual([]);
    q.get((item) => log.push(`got ${item}`));
    expect(q.length).toBe(1); // reserved for the getter
    sim.runUntil(0);
    expect(log).toEqual(['stored a', 'stored b', 'got a']);
  });

  it('make getters wait for an item, FIFO', () => {
    const sim = newSim();
    const q = sim.createQueue<number>('buf');
    const got: string[] = [];
    q.get((i) => got.push(`g1:${i}`));
    q.get((i) => got.push(`g2:${i}`));
    sim.schedule(3, () => {
      q.put(10, () => undefined);
      q.put(20, () => undefined);
    });
    sim.runUntil(3);
    expect(got).toEqual(['g1:10', 'g2:20']);
    expect(q.length).toBe(0);
  });

  it('make put wait when a finite buffer is full (blocking)', () => {
    const sim = newSim();
    const q = sim.createQueue<string>('buf', 1);
    const log: string[] = [];
    q.put('a', () => log.push(`stored a@${sim.now}`));
    q.put('b', () => log.push(`stored b@${sim.now}`));
    expect(q.length).toBe(1);
    sim.schedule(5, () => q.get((i) => log.push(`got ${i}@${sim.now}`)));
    sim.runUntil(10);
    expect(log).toEqual(['stored a@0', 'got a@5', 'stored b@5']);
    expect(q.length).toBe(1);
  });

  it('cancel() withdraws waiting puts and gets, not granted ones', () => {
    const sim = newSim();
    const q = sim.createQueue<string>('buf', 1);
    const log: string[] = [];
    const p1 = q.put('a', () => log.push('a'));
    const p2 = q.put('b', () => log.push('b'));
    expect(p1.cancel()).toBe(false);
    expect(p2.cancel()).toBe(true);
    const g1 = q.get((i) => log.push(`got ${i}`));
    expect(g1.cancel()).toBe(false);
    const g2 = q.get((i) => log.push(`got2 ${i}`));
    expect(g2.cancel()).toBe(true);
    q.put('c', () => log.push('c'));
    sim.runUntil(0);
    expect(log).toEqual(['a', 'got a', 'c']);
    expect(q.length).toBe(1);
  });

  it('report the time-average length, reset by resetStatistics()', () => {
    const sim = newSim();
    const q = sim.createQueue<number>('buf', 3);
    q.put(1, () => undefined);
    q.put(2, () => undefined);
    sim.runUntil(10);
    q.get(() => undefined);
    sim.runUntil(20);
    expect(q.averageLength()).toBeCloseTo((2 * 10 + 1 * 10) / 20, 12);
    sim.resetStatistics();
    sim.runUntil(30);
    expect(q.averageLength()).toBe(1);
  });

  it('keep FIFO order across thousands of items (internal compaction)', () => {
    const sim = newSim();
    const q = sim.createQueue<number>('big');
    const got: number[] = [];
    for (let i = 0; i < 5000; i++) q.put(i, () => undefined);
    for (let i = 0; i < 4000; i++) q.get((item) => got.push(item));
    for (let i = 5000; i < 6000; i++) q.put(i, () => undefined);
    for (let i = 0; i < 2000; i++) q.get((item) => got.push(item));
    sim.runUntil(0);
    expect(got).toEqual(Array.from({ length: 6000 }, (_, i) => i));
    expect(q.length).toBe(0);
  });

  it('reject an invalid capacity', () => {
    const sim = newSim();
    for (const c of [0, -2, 2.5, NaN]) expect(() => sim.createQueue('x', c)).toThrow();
  });
});

describe('statistics', () => {
  it('Tally computes count, mean, sample variance, min and max', () => {
    const sim = newSim();
    const t = sim.createTally();
    expect(t.count).toBe(0);
    expect(t.mean).toBeNaN();
    expect(t.variance).toBeNaN();
    expect(t.min).toBeNaN();
    expect(t.max).toBeNaN();
    t.add(4);
    expect(t.mean).toBe(4);
    expect(t.variance).toBeNaN();
    for (const v of [7, 13, 16]) t.add(v);
    expect(t.count).toBe(4);
    expect(t.mean).toBe(10);
    expect(t.variance).toBeCloseTo(30, 12);
    expect(t.min).toBe(4);
    expect(t.max).toBe(16);
    t.reset();
    expect(t.count).toBe(0);
    expect(t.mean).toBeNaN();
  });

  it('TimeWeighted averages over simulated time', () => {
    const sim = newSim();
    const w = sim.createTimeWeighted(2);
    expect(w.current).toBe(2);
    expect(w.mean()).toBe(2); // no time passed
    sim.runUntil(10);
    w.update(6);
    sim.runUntil(20);
    expect(w.mean()).toBeCloseTo(4, 12);
    w.reset();
    expect(w.mean()).toBe(6);
    expect(sim.createTimeWeighted().current).toBe(0);
  });

  it('Tally.add and TimeWeighted.update reject NaN and ±Infinity', () => {
    const sim = newSim();
    const t = sim.createTally();
    const w = sim.createTimeWeighted();
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(() => t.add(bad)).toThrow();
      expect(() => w.update(bad)).toThrow();
    }
    expect(t.count).toBe(0);
    expect(w.current).toBe(0);
  });

  it('createTimeWeighted(initial) rejects NaN and ±Infinity', () => {
    const sim = newSim();
    for (const bad of [NaN, Infinity, -Infinity]) {
      expect(() => sim.createTimeWeighted(bad)).toThrow();
    }
  });

  it('resetStatistics() resets every tally and time-weighted stat at now', () => {
    const sim = newSim();
    const t = sim.createTally();
    const w = sim.createTimeWeighted(0);
    t.add(1);
    sim.runUntil(5);
    w.update(10);
    sim.runUntil(10);
    sim.resetStatistics();
    expect(t.count).toBe(0);
    expect(w.mean()).toBe(10);
  });
});

describe('a small line: source → station → sink', () => {
  it('moves parts through a resource with a buffer in front', () => {
    const sim = newSim();
    const buffer = sim.createQueue<Entity>('in', 2);
    const station = sim.createResource('st', 1);
    const done: number[] = [];
    for (let i = 0; i < 5; i++) {
      sim.schedule(i, () => buffer.put(sim.createEntity({}), () => undefined));
    }
    const pull = () =>
      buffer.get((part) =>
        station.request(part, () =>
          sim.schedule(3, () => {
            station.release(part);
            done.push(sim.now);
            pull();
          }),
        ),
      );
    pull();
    sim.runUntil(100);
    expect(done).toEqual([3, 6, 9, 12, 15]);
  });
});
