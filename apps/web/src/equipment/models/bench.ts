import { gridSlots } from './anchors';
import { cyl, real, slab } from './parts';
import type { ModelDefinition, ModelPart } from './types';

/** How far in front of the footprint the operator stands (m). */
export const OPERATOR_OFFSET = 0.45;

/**
 * Steel workbench in the style of a catalogue industrial bench: four legs on levelling feet, a
 * laminate top, a rear upright carrying a louvered panel with bins, a riser shelf and an LED
 * light bar, and a lower shelf. Legs, upright posts and the light bar keep their real size
 * (EQ-5); everything else follows the footprint and height.
 */
export const bench: ModelDefinition = {
  id: 'bench',
  label: 'Workbench',
  behaviors: ['workstation'],
  lodDistances: [60],
  build({ width: w, length: l, height: h }) {
    const s = real(0.05, Math.min(w, l), 0.2); // leg and post section
    const ty = h * 0.62; // work surface height
    const span = h - ty; // room above the top for the upright
    const tt = Math.min(0.04, ty * 0.25); // top thickness
    const fh = Math.min(0.03, ty * 0.15); // levelling foot height
    const lh = Math.min(0.05, span * 0.3); // light bar housing height
    const bd = real(0.1, l, 0.3); // light bar depth
    const inner = w - 2 * s;
    const cx = w / 2 - s / 2;
    const cz = l / 2 - s / 2;
    const corners: [number, number][] = [
      [-cx, -cz],
      [cx, -cz],
      [-cx, cz],
      [cx, cz],
    ];
    const frame = { role: 'frame', fixed: true } as const;

    const top = slab(w, tt, l, ty - tt);
    const legs = corners.map(([x, z]) => slab(s, ty - tt - fh, s, fh, x, z, frame));
    const feet = corners.map(([x, z]) =>
      cyl(s * 0.4, s * 0.4, fh, 0, x, z, { role: 'dark', fixed: true, segments: 12 }),
    );
    const posts = [-cx, cx].map((x) => slab(s, span, s, ty, x, -cz, frame));
    const bar = slab(w, lh, bd, h - lh, 0, -l / 2 + bd / 2, { role: 'dark', fixed: true });
    const lower = slab(inner, 0.025, l - 2 * s, ty * 0.22, 0, 0, { role: 'accent' });
    const panelY = ty + span * 0.08;
    const panel = slab(inner, span * 0.84 - lh, 0.02, panelY, 0, -l / 2 + 0.01, { role: 'dark' });
    const rd = Math.min(0.22, l * 0.3);
    const riser = slab(inner, 0.025, rd, ty + span * 0.25, 0, -l / 2 + 0.02 + rd / 2, {
      role: 'accent',
    });

    const bw = (inner / 4) * 0.8;
    const bdp = Math.min(0.1, l * 0.15);
    const bins = [0, 1, 2, 3].map((i) =>
      slab(
        bw,
        span * 0.12,
        bdp,
        ty + span * 0.5,
        -inner / 2 + ((i + 0.5) * inner) / 4,
        -l / 2 + 0.02 + bdp / 2,
        {
          role: 'accent',
        },
      ),
    );
    // Louvers: three thin ribs above the bins.
    const ribs = [0.66, 0.72, 0.78].map((f) =>
      slab(inner, 0.01, 0.03, ty + span * f, 0, -l / 2 + 0.035, { role: 'frame' }),
    );
    const led = slab(inner, 0.01, bd * 0.7, h - lh - 0.01, 0, -l / 2 + bd / 2, { role: 'glass' });

    const full: ModelPart[] = [
      top,
      ...legs,
      ...feet,
      ...posts,
      bar,
      led,
      lower,
      panel,
      riser,
      ...bins,
      ...ribs,
    ];
    const low: ModelPart[] = [top, ...legs, ...posts, bar, lower, panel, riser];

    return {
      lods: [full, low],
      anchors: {
        label: [0, h, 0],
        input: [0, ty, -l / 2],
        output: [0, ty, l / 2],
        queueSlot: gridSlots({
          x0: -w / 2 + s,
          x1: w / 2 - s,
          z0: l * 0.2,
          z1: l / 2,
          levels: [ty],
          yMax: Math.min(ty + 0.6, h),
        }),
        statusLight: [cx, h, -cz],
        workSurface: [0, ty, 0],
        inTray: [-l * 0.1, l * 0.1].map((z): [number, number, number] => [-w * 0.32, ty, z]),
        outTray: [-l * 0.1, l * 0.1].map((z): [number, number, number] => [w * 0.32, ty, z]),
        operator: [0, 0, l / 2 + OPERATOR_OFFSET],
        operatorFacing: [0, 0, -1],
      },
    };
  },
};
