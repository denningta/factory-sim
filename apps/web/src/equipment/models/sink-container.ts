import { gridSlots } from './anchors';
import { slab, LOD_DISTANCE } from './parts';
import type { ModelDefinition } from './types';

/** Shipping: an open container with a dark mouth, and a stack of pallets waiting beside it. */
export const sinkContainer: ModelDefinition = {
  id: 'sink-container',
  label: 'Shipping container',
  behaviors: ['sink'],
  lodDistances: [LOD_DISTANCE],
  build({ width: w, length: l, height: h }) {
    const base = h * 0.1;
    const lip = h * 0.02;
    const bodyTop = h - lip;
    const pallet = h * 0.12;
    const parts = [
      slab(w, base, l, 0, 0, 0, { role: 'frame' }),
      slab(w * 0.6, bodyTop - base, l * 0.9, base, -w * 0.2, 0),
      slab(w * 0.5, lip, l * 0.75, bodyTop, -w * 0.2, 0, { role: 'dark' }),
    ];
    for (let i = 0; i < 3; i++)
      parts.push(
        slab(w * 0.3, pallet, l * 0.6, base + i * pallet, w * 0.3, 0, {
          role: i % 2 ? 'accent' : 'frame',
        }),
      );
    return {
      lods: [parts, [parts[0]!, parts[1]!]],
      anchors: {
        label: [0, h, 0],
        input: [-w * 0.2, h, 0],
        output: [-w * 0.2, h, 0],
        queueSlot: gridSlots({
          x0: w * 0.15,
          x1: w * 0.45,
          z0: -l * 0.3,
          z1: l * 0.3,
          levels: [base + 3 * pallet],
          yMax: h,
        }),
      },
    };
  },
};
