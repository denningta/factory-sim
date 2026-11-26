import { describe, expect, it } from 'vitest';
import type { LineEvent } from '@factory-sim/sim-engine';
import { createPartTracks } from './partTracks';
import { createRunSession } from './runSession';
import { realLine } from './testLine';

describe('UI-5 AC2: queue count comes from the part tracks', () => {
  it('counts the parts waiting at a station input, and drops one when it starts', () => {
    const { project, geometry, colors } = realLine();
    const src = project.equipment.find((e) => e.behavior === 'source')!.id;
    const ws = project.equipment.find((e) => e.behavior === 'workstation')!.id;
    const rel = (t: number, partId: number): LineEvent => ({
      t,
      type: 'partReleased',
      partId,
      productId: project.products[0]!.id,
      sourceId: src,
    });
    const enter = (t: number, partId: number): LineEvent => ({
      t,
      type: 'partEntered',
      partId,
      equipmentId: ws,
    });
    const tr = createPartTracks(geometry, colors);
    tr.ingest([rel(0, 1), enter(1, 1), rel(1, 2), enter(2, 2)]);
    tr.at(3);
    expect(tr.queueLengths().get(ws)).toBe(2);
    tr.ingest([{ t: 4, type: 'partStarted', partId: 1, equipmentId: ws } as LineEvent]);
    tr.at(5);
    expect(tr.queueLengths().get(ws)).toBe(1);
  });

  it('is empty while animation is off', () => {
    const r = createRunSession(realLine().project, { seed: 1, warmUp: 0, runLength: 1000 });
    if (!r.ok) throw new Error('compile');
    r.session.setAnimate(false);
    expect(r.session.queueLengths().size).toBe(0);
  });
});
