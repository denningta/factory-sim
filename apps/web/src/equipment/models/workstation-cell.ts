import { gridSlots } from './anchors';
import { cyl, LOW_SEGMENTS, real, slab, LOD_DISTANCE } from './parts';
import type { ModelDefinition } from './types';

/** Light pole radius (m). */
const POLE_R = 0.03;

/** Cabinet with a machine block on top and a signal tower: a manned work cell. */
export const workstationCell: ModelDefinition = {
  id: 'workstation-cell',
  label: 'Work cell',
  behaviors: ['workstation'],
  lodDistances: [LOD_DISTANCE],
  build({ width: w, length: l, height: h }) {
    const cab = h * 0.55;
    const mach = h * 0.35;
    const r = real(POLE_R, Math.min(w, l), 0.08);
    const pole: [number, number] = [w * 0.4, -l * 0.35];
    return {
      lods: [
        [
          slab(w, cab, l, 0),
          slab(w * 0.6, mach, l * 0.6, cab, 0, l * 0.1, { role: 'accent' }),
          cyl(r, r, h - cab, cab, ...pole, { role: 'dark', fixed: true }),
        ],
        [
          slab(w, cab, l, 0),
          slab(w * 0.6, mach, l * 0.6, cab, 0, l * 0.1, { role: 'accent' }),
          cyl(r, r, h - cab, cab, ...pole, { role: 'dark', fixed: true, segments: LOW_SEGMENTS }),
        ],
      ],
      anchors: {
        label: [0, h, 0],
        input: [0, cab, -l / 2],
        output: [0, cab, l / 2],
        // Free cabinet top behind the machine block, clear of the pole.
        queueSlot: gridSlots({
          x0: -w / 2,
          x1: w * 0.3,
          z0: -l / 2,
          z1: -l * 0.2,
          levels: [cab],
          yMax: h,
        }),
        statusLight: [pole[0], h, pole[1]],
        // The side away from the pole, across the flow (ports are back and front).
        operator: [-w / 2, 0, 0],
      },
    };
  },
};
