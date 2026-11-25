import { describe, expect, it } from 'vitest';
import { createRunSession } from './runSession';
import { realLine } from './testLine';

describe('UI-5 AC2: queue count comes from the part tracks', () => {
  it('counts parts waiting at a station input', () => {
    const { project } = realLine();
    const r = createRunSession(project, { seed: 1, warmUp: 0, runLength: 1000 });
    if (!r.ok) throw new Error('compile');
    const ws = project.equipment.find((e) => e.behavior === 'workstation')!;
    let max = 0;
    for (let i = 0; i < 300; i++) {
      r.session.step();
      r.session.poses(r.session.now);
      max = Math.max(max, r.session.queueLengths().get(ws.id) ?? 0);
    }
    expect(max).toBeGreaterThan(0);
  });
});
