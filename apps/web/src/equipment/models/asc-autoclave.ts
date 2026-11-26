import { gridSlots } from './anchors';
import { OPERATOR_OFFSET } from './bench';
import { cyl, cylZ, LOW_SEGMENTS, real, slab } from './parts';
import type { ModelDefinition } from './types';

/**
 * ASC-style autoclave: a horizontal pressure vessel on two saddles with a domed rear head, a
 * domed door with a side hinge and a locking ring, load rails running out of the door with a
 * cart on them, and a control cabinet with a status light beside the cart. The vessel takes
 * the back 62% of the footprint; the cart is pulled out in front of the door, so waiting
 * parts sit on it in plain view. The light pole keeps its real size (EQ-5).
 */
export const ascAutoclave: ModelDefinition = {
  id: 'asc-autoclave',
  label: 'Autoclave (ASC)',
  behaviors: ['workstation'],
  lodDistances: [60],
  build({ width: w, length: l, height: h }) {
    const r = Math.min(w * 0.42, h * 0.32); // vessel radius
    const sh = h * 0.14; // floor to the vessel's underside
    const yc = sh + r; // vessel axis height
    const vl = l * 0.62; // vessel length, back to door
    const z0 = -l / 2;
    const zf = z0 + vl; // door plane
    const head = vl * 0.1; // dome depth, front and back
    const shellLen = vl - 2 * head;
    const front = l / 2 - zf; // depth of the cart zone

    const shell = (segments?: number) =>
      cylZ(r, r, shellLen, yc, 0, z0 + head + shellLen / 2, { role: 'body', segments });
    const rear = cylZ(r, r * 0.55, head, yc, 0, z0 + head / 2);
    const door = (segments?: number) =>
      cylZ(r * 0.55, r, head, yc, 0, zf - head / 2, { role: 'accent', segments });
    const ring = cylZ(r * 1.04, r * 1.04, vl * 0.03, yc, 0, zf - head - vl * 0.015, {
      role: 'dark',
    });
    const wheel = cylZ(r * 0.18, r * 0.18, vl * 0.02, yc, 0, zf + vl * 0.01, { role: 'dark' });
    const hinge = slab(w * 0.03, r * 0.9, vl * 0.04, yc - r * 0.45, r * 1.02, zf - head * 0.5, {
      role: 'dark',
    });
    const saddles = [0.22, 0.7].map((t) =>
      slab(r * 1.5, sh + r * 0.4, vl * 0.06, 0, 0, z0 + vl * t, { role: 'frame' }),
    );

    // Cart on rails, pulled out in front of the door.
    const cw = Math.min(w * 0.8, r * 1.9);
    const cl = front * 0.82;
    const cz = zf + front * 0.06 + cl / 2;
    const ct = r * 0.12; // cart deck thickness
    const ch = sh + r * 0.1; // cart deck top
    const rt = r * 0.1; // rail thickness
    const railZ0 = z0 + vl * 0.4;
    const railZ1 = l / 2 - l * 0.02;
    const deck = slab(cw, ct, cl, ch - ct, 0, cz, { role: 'accent' });
    const rails = [-1, 1].map((s) =>
      slab(cw * 0.08, rt, railZ1 - railZ0, ch - ct - rt, s * cw * 0.46, (railZ0 + railZ1) / 2, {
        role: 'dark',
      }),
    );

    // Control cabinet on the right, beside the cart, with its light on a pole.
    const cabW = w * 0.14;
    const cabX = w / 2 - cabW / 2;
    const cabD = l * 0.24;
    const cabZ = zf + front * 0.5;
    const cabH = h * 0.7;
    const cabinet = slab(cabW, cabH, cabD, 0, cabX, cabZ, { role: 'frame' });
    const screen = slab(
      w * 0.015,
      h * 0.14,
      cabD * 0.5,
      cabH * 0.55,
      w / 2 - cabW - w * 0.0075,
      cabZ,
      {
        role: 'screen',
      },
    );
    const pr = real(0.03, Math.min(w, l), 0.08);
    const poleX = Math.min(cabX, w / 2 - pr); // a real-size pole must not poke out of a tiny footprint
    const pole = (segments?: number) =>
      cyl(pr, pr, h - cabH, cabH, poleX, cabZ, {
        role: 'accent',
        fixed: true,
        ...(segments ? { segments } : {}),
      });

    return {
      lods: [
        [
          shell(),
          rear,
          door(),
          ring,
          wheel,
          hinge,
          ...saddles,
          deck,
          ...rails,
          cabinet,
          screen,
          pole(),
        ],
        [shell(LOW_SEGMENTS), door(LOW_SEGMENTS), ...saddles, deck, cabinet, pole(LOW_SEGMENTS)],
      ],
      anchors: {
        label: [0, h, 0],
        input: [0, yc, z0],
        output: [0, ch, l / 2],
        // The batch sits on the cart; extra parts stack up on it.
        queueSlot: gridSlots({
          x0: -cw / 2,
          x1: cw / 2,
          z0: cz - cl / 2,
          z1: cz + cl / 2,
          levels: [ch],
          yMax: h,
        }),
        statusLight: [poleX, h, cabZ],
        workSurface: [0, yc, z0 + vl / 2],
        operator: [0, 0, l / 2 + OPERATOR_OFFSET],
        operatorFacing: [0, 0, -1],
      },
    };
  },
};
