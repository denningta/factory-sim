import { gridSlots } from './anchors';
import { real, slab, LOD_DISTANCE } from './parts';
import type { ModelDefinition } from './types';

const POST = 0.06;
const SHELVES = [0.1, 0.45, 0.8];

/** Open rack: four posts, three shelves, a crate on each shelf. */
export const bufferRack: ModelDefinition = {
  id: 'buffer-rack',
  label: 'Shelf rack',
  behaviors: ['buffer'],
  lodDistances: [LOD_DISTANCE],
  build({ width: w, length: l, height: h }) {
    const post = real(POST, Math.min(w, l), 0.2);
    const t = h * 0.04;
    const crate = h * 0.14;
    // Waiting parts rest on the crate tops, where they show, not on the shelves under the crates.
    const levels = SHELVES.map((f) => h * f + t + crate);
    const parts = [];
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        parts.push(
          slab(post, h, post, 0, sx * (w / 2 - post / 2), sz * (l / 2 - post / 2), {
            role: 'frame',
            fixed: true,
          }),
        );
    for (const f of SHELVES) {
      parts.push(slab(w, t, l, h * f));
      parts.push(slab(w * 0.6, crate, l * 0.6, h * f + t, 0, 0, { role: 'accent' }));
    }
    return {
      lods: [parts, [slab(w, h, l, 0)]],
      anchors: {
        label: [0, h, 0],
        input: [0, levels[0]!, -l / 2],
        output: [0, levels[0]!, l / 2],
        queueSlot: gridSlots({
          x0: -w * 0.3,
          x1: w * 0.3,
          z0: -l * 0.3,
          z1: l * 0.3,
          levels,
          yMax: h,
        }),
      },
    };
  },
};
