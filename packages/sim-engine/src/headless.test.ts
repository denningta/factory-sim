import { describe, expect, it } from 'vitest';
import { createSimulation } from './index';

function trace(seed: number): string {
  const sim = createSimulation({ seed });
  const rng = sim.rng.fork('src');
  const station = sim.createResource('st', 1);
  const out: string[] = [];
  const arrive = () => {
    const part = sim.createEntity({ kind: rng.integer(0, 2) });
    station.request(part, () =>
      sim.schedule(rng.exponential(1), () => {
        station.release(part);
        out.push(`${part.id}:${part.kind}@${sim.now}`);
      }),
    );
    sim.schedule(rng.exponential(1.2), arrive);
  };
  arrive();
  sim.runUntil(500);
  return out.join(',');
}

// The import boundary (no DOM, Node, React or three in src) is enforced by lint, see eslint.config.
/** FNV-1a over UTF-16 code units, as 8 hex digits. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(16).padStart(8, '0');
}

describe('runs with no 3D view attached', () => {
  it('runs a model in plain Node, without window, document or a renderer', () => {
    expect(typeof (globalThis as Record<string, unknown>).window).toBe('undefined');
    expect(typeof (globalThis as Record<string, unknown>).document).toBe('undefined');
    const t = trace(5);
    expect(t.length).toBeGreaterThan(0);
    expect(trace(5)).toBe(t); // same seed + model ⇒ identical results
    expect(trace(6)).not.toBe(t);
  });

  it('produces the golden trace for seed 5 (assert the same hash in browser/worker tests)', () => {
    expect(hash(trace(5))).toMatchInlineSnapshot(`"e98cb273"`);
  });
});
