import { describe, expect, it } from 'vitest';
import { compileLine, createRun, type LineEvent, type StationState } from './index';
import { fixed, lineProject } from './line-fixture';

/** S1 (10 s) feeds a slower S2 (20 s); parts queue at S2, and both stations change state over time. */
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

/** The states a consumer would rebuild by replaying stationState events. */
function replay(events: LineEvent[]): Record<string, StationState> {
  const out: Record<string, StationState> = {};
  for (const e of events) if (e.type === 'stationState') out[e.stationId] = e.state;
  return out;
}

describe('AN-4: Run.stationStates() gives each station its current state', () => {
  it('starts starved at t = 0, in model order', () => {
    const r = newRun();
    expect(r.stationStates()).toEqual({ S1: 'starved', S2: 'starved' });
    expect(Object.keys(r.stationStates())).toEqual(['S1', 'S2']);
  });

  it('matches replaying the events, with events on', () => {
    const r = newRun();
    const events: LineEvent[] = [];
    const seen = new Set<StationState>();
    for (let t = 1; t <= 300; t++) {
      r.runUntil(t);
      events.push(...r.drainEvents());
      expect(r.stationStates()).toEqual(replay(events));
      for (const st of Object.values(r.stationStates())) seen.add(st);
    }
    // Stations move between states over the scan, so the check covers changes, not one value.
    expect(seen).toEqual(new Set(['starved', 'working']));
  });

  it('is identical with events off', () => {
    for (const t of [33, 137, 600]) {
      const on = newRun();
      on.runUntil(t);
      const off = newRun();
      off.drainEvents();
      off.setEventsEnabled(false);
      off.runUntil(t);
      expect(off.drainEvents()).toEqual([]);
      expect(off.stationStates()).toEqual(on.stationStates());
    }
  });
});
