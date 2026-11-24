import { gridSlots } from './anchors';
import { real, slab, LOD_DISTANCE } from './parts';
import type { ModelDefinition } from './types';

const RAIL = 0.05;

/** Long low belt on legs with side rails; long and thin where the others are blocky. */
export const conveyorBelt: ModelDefinition = {
  id: 'conveyor-belt',
  label: 'Belt conveyor',
  behaviors: ['conveyor'],
  lodDistances: [LOD_DISTANCE],
  build({ width: w, length: l, height: h }) {
    const rail = real(RAIL, w, 0.2);
    const belt = h * 0.12;
    const legH = h - belt - h * 0.1;
    // Legs keep their real size too, but never run past a short belt's ends.
    const leg = real(RAIL, l, 0.5);
    const legZ = Math.min(0.45 * l, l / 2 - leg / 2);
    const parts = [slab(w - 2 * rail, belt, l, legH, 0, 0, { role: 'dark' })];
    for (const s of [-1, 1])
      parts.push(slab(rail, h - legH, l, legH, s * (w / 2 - rail / 2), 0, { fixed: true }));
    for (const s of [-1, 1])
      for (const z of [-legZ, legZ])
        parts.push(
          slab(rail, legH, leg, 0, s * (w / 2 - rail / 2), z, { role: 'frame', fixed: true }),
        );
    const top = legH + belt;
    return {
      lods: [parts, [slab(w, h, l, 0)]],
      anchors: {
        label: [0, h, 0],
        input: [0, top, -l / 2],
        output: [0, top, l / 2],
        queueSlot: gridSlots({
          x0: -w / 2 + rail,
          x1: w / 2 - rail,
          z0: -l / 2,
          z1: l / 2,
          levels: [top],
          yMax: h,
        }),
      },
    };
  },
};
