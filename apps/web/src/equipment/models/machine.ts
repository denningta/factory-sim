import { gridSlots } from './anchors';
import { OPERATOR_OFFSET } from './bench';
import { cyl, LOW_SEGMENTS, real, slab } from './parts';
import type { ModelDefinition } from './types';

/**
 * Enclosed automatic machine: a cabinet on a plinth with a window in the front door, a control
 * pendant on an arm beside it and a signal pole on top. Pole, arm and pendant keep their real
 * size (EQ-5).
 */
export const machine: ModelDefinition = {
  id: 'machine',
  label: 'Machine',
  behaviors: ['workstation'],
  lodDistances: [60],
  build({ width: w, length: l, height: h }) {
    const cab = h * 0.85; // cabinet top
    const plinth = Math.min(0.1, cab * 0.15);
    const cl = l * 0.8; // cabinet depth, set back so the pendant and trays fit in front
    const cz = -l / 2 + cl / 2;
    const front = cz + cl / 2;
    const r = real(0.03, Math.min(w, l), 0.08); // pole and arm radius
    const pole: [number, number] = [w * 0.4, -l * 0.35];
    const px = w * 0.35; // pendant arm
    const pz = front + (l / 2 - front) / 2;
    const pw = real(0.18, w, 0.3);
    const pd = real(0.06, l - cl, 0.5);
    const ph = Math.min(0.26, cab * 0.4);
    const armTop = cab * 0.55 + ph;
    const body = slab(w, cab - plinth, cl, plinth, 0, cz);
    const base = slab(w, plinth, cl, 0, 0, cz, { role: 'dark' });
    const win = slab(w * 0.55, cab * 0.35, 0.02, cab * 0.45, -w * 0.08, front - 0.01, {
      role: 'glass',
    });
    const frameL = slab(w * 0.6, cab * 0.4, 0.01, cab * 0.425, -w * 0.08, front - 0.005, {
      role: 'dark',
    });
    const arm = (segments?: number) =>
      cyl(r, r, armTop, 0, px, pz, {
        role: 'dark',
        fixed: true,
        ...(segments ? { segments } : {}),
      });
    const pendant = slab(pw, ph, pd, cab * 0.55, px, pz, { role: 'screen', fixed: true });
    const light = (segments?: number) =>
      cyl(r, r, h - cab, cab, ...pole, {
        role: 'accent',
        fixed: true,
        ...(segments ? { segments } : {}),
      });

    return {
      lods: [
        [body, base, frameL, win, arm(), pendant, light()],
        [body, base, win, arm(LOW_SEGMENTS), pendant, light(LOW_SEGMENTS)],
      ],
      anchors: {
        label: [0, h, 0],
        input: [0, cab, -l / 2],
        output: [0, cab, front],
        queueSlot: gridSlots({
          x0: -w / 2,
          x1: w * 0.3,
          z0: -l / 2,
          z1: -l * 0.1,
          levels: [cab],
          yMax: h,
        }),
        statusLight: [pole[0], h, pole[1]],
        workSurface: [0, cab * 0.4, cz],
        inTray: [[-w * 0.3, cab, front - 0.1 * l]],
        outTray: [[w * 0.2, cab, front - 0.1 * l]],
        operator: [0, 0, l / 2 + OPERATOR_OFFSET],
        operatorFacing: [0, 0, -1],
      },
    };
  },
};
