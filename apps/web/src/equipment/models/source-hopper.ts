import { gridSlots } from './anchors';
import { cyl, LOW_SEGMENTS, slab, LOD_DISTANCE } from './parts';
import type { ModelDefinition } from './types';

/** Pallet, round drum and a funnel: material goes in at the top, out at the base. */
export const sourceHopper: ModelDefinition = {
  id: 'source-hopper',
  label: 'Hopper',
  behaviors: ['source'],
  lodDistances: [LOD_DISTANCE],
  build({ width: w, length: l, height: h }) {
    const r = Math.min(w, l) / 2;
    const pal = h * 0.1;
    const drum = h * 0.5;
    return {
      lods: [
        [
          slab(w, pal, l, 0, 0, 0, { role: 'frame' }),
          cyl(r * 0.8, r * 0.8, drum, pal),
          cyl(r * 0.95, r * 0.8, h - pal - drum, pal + drum, 0, 0, { role: 'accent' }),
        ],
        [
          slab(w, pal, l, 0, 0, 0, { role: 'frame' }),
          cyl(r * 0.8, r * 0.8, h - pal, pal, 0, 0, { segments: LOW_SEGMENTS }),
        ],
      ],
      anchors: {
        label: [0, h, 0],
        input: [0, h, 0],
        output: [0, pal, l / 2],
        queueSlot: gridSlots({
          x0: -r * 0.6,
          x1: r * 0.6,
          z0: -r * 0.6,
          z1: r * 0.6,
          levels: [h],
          yMax: h,
        }),
      },
    };
  },
};
