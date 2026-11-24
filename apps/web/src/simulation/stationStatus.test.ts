import { describe, expect, it } from 'vitest';
import type { LineEvent } from '@factory-sim/sim-engine';
import { createStationStates, findBottleneck, STATE_COLORS } from './stationStatus';
import { createRunSession } from './runSession';
import { realLine } from './testLine';

const ev = (t: number, stationId: string, state: 'working' | 'starved' | 'blocked' | 'idle') =>
  ({ t, type: 'stationState', stationId, state }) as LineEvent;

describe('AN-3 AC1: live colors: working green, starved yellow, blocked red, idle gray', () => {
  it('uses the wireframe colors', () => {
    expect(STATE_COLORS).toEqual({
      working: '#86d9a0',
      starved: '#f6d860',
      blocked: '#ee8c8c',
      idle: '#cfd4dc',
    });
  });

  it('tracks the latest state of each station from the engine events', () => {
    const s = createStationStates();
    s.ingest([
      ev(0, 'a', 'starved'),
      ev(0, 'b', 'starved'),
      { t: 1, type: 'techState', techId: 't', state: 'idle' },
    ]);
    s.ingest([ev(2, 'a', 'working'), ev(3, 'a', 'blocked')]);
    expect(s.current().get('a')).toBe('blocked');
    expect(s.current().get('b')).toBe('starved');
    expect(s.current().size).toBe(2);
  });

  it('a running session reports every workstation in a valid state, changing over time', () => {
    const r = createRunSession(realLine().project, { seed: 1, warmUp: 0, runLength: 1000 });
    if (!r.ok) throw new Error('compile');
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      r.session.step();
      for (const st of r.session.stationStates().values()) seen.add(st);
    }
    expect(r.session.stationStates().size).toBeGreaterThan(0);
    expect(seen.has('working')).toBe(true);
    for (const st of seen) expect(Object.keys(STATE_COLORS)).toContain(st);
  });

  it('is empty after a reset', () => {
    const r = createRunSession(realLine().project, { seed: 1, warmUp: 0, runLength: 1000 });
    if (!r.ok) throw new Error('compile');
    r.session.step();
    r.session.reset();
    for (const st of r.session.stationStates().values()) expect(st).not.toBe('working');
  });
});

describe('AN-3 AC2: the station with the highest working % is the bottleneck', () => {
  it('picks the highest working share', () => {
    expect(
      findBottleneck([
        { id: 'a', working: 40 },
        { id: 'b', working: 90 },
        { id: 'c', working: 70 },
      ]),
    ).toBe('b');
  });

  it('breaks ties by layout order', () => {
    expect(
      findBottleneck([
        { id: 'a', working: 50 },
        { id: 'b', working: 50 },
      ]),
    ).toBe('a');
  });

  it('flags nothing before any station has worked, or with no stations', () => {
    expect(findBottleneck([{ id: 'a', working: 0 }])).toBeNull();
    expect(findBottleneck([])).toBeNull();
  });
});
