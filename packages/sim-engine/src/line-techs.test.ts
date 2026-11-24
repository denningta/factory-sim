import { describe, expect, it } from 'vitest';
import { compileLine, createRun } from './index';
import { fixed, lineProject } from './line-fixture';

/** One tech runs S1 and S2 (4 m apart at 1 m/s): S1 0–10, walk 10–14, S2 14–24, idle at S2. */
function newRun() {
  const c = compileLine(
    lineProject({
      products: ['A'],
      stations: [
        { id: 'S1', cycle: { A: fixed(10) } },
        { id: 'S2', cycle: { A: fixed(10) } },
      ],
      interval: fixed(60),
      techs: [{ id: 'T', name: 'T', walkSpeed: 1, stationIds: ['S1', 'S2'] }],
    }),
  );
  if (!c.ok) throw new Error(JSON.stringify(c.issues));
  return createRun(c.model, { seed: 1, warmUp: 0, runLength: 3600 });
}

describe('TE-3: Run.techs() says where each tech is', () => {
  it('reports a walk in progress with the techMoved event that started it', () => {
    const r = newRun();
    r.runUntil(12);
    const walk = r.drainEvents().findLast((e) => e.type === 'techMoved');
    expect(r.techs()).toEqual([{ techId: 'T', state: 'walking', atId: 'S1', walk }]);
    expect(walk).toMatchObject({ fromId: 'S1', toId: 'S2', arrivesAt: 14 });
  });

  it('reports the station after arrival, with no walk', () => {
    const r = newRun();
    r.runUntil(20);
    expect(r.techs()).toEqual([{ techId: 'T', state: 'working', atId: 'S2' }]);
    r.runUntil(30);
    expect(r.techs()).toEqual([{ techId: 'T', state: 'idle', atId: 'S2' }]);
  });

  it('is identical with events off, mid-walk included', () => {
    // Second part at 60: the tech walks S2 → S1 from 60 to 64.
    for (const t of [62, 70]) {
      const on = newRun();
      on.runUntil(t);
      const off = newRun();
      off.drainEvents();
      off.setEventsEnabled(false);
      off.runUntil(t);
      expect(off.drainEvents()).toEqual([]);
      expect(off.techs()).toEqual(on.techs());
    }
    const r = newRun();
    r.setEventsEnabled(false);
    r.runUntil(62);
    expect(r.techs()[0]).toMatchObject({ state: 'walking', atId: 'S2', walk: { toId: 'S1' } });
  });

  it('returns copies', () => {
    const r = newRun();
    r.runUntil(12);
    r.techs()[0]!.walk!.toId = 'X';
    expect(r.techs()[0]!.walk!.toId).toBe('S2');
  });
});
