import type { EquipmentType } from '@factory-sim/schema';

type Vec3 = [number, number, number];

/**
 * A primitive of an equipment model, in local meters: origin at the center of the footprint
 * on the floor, x = footprint width, z = footprint length, y up. `tone` scales the type's
 * color so parts read apart without adding palette colors.
 */
export type Part =
  | { shape: 'box'; size: Vec3; position: Vec3; tone: number }
  | {
      shape: 'cylinder';
      radiusTop: number;
      radiusBottom: number;
      height: number;
      position: Vec3;
      tone: number;
    };

const box = (size: Vec3, position: Vec3, tone = 1): Part => ({
  shape: 'box',
  size,
  position,
  tone,
});

/** Sits a box of height `h` on `y0`; `position` is the box center. */
const slab = (w: number, h: number, l: number, y0: number, x = 0, z = 0, tone = 1): Part =>
  box([w, h, l], [x, y0 + h / 2, z], tone);

const cyl = (rTop: number, rBottom: number, h: number, y0: number, tone = 1): Part => ({
  shape: 'cylinder',
  radiusTop: rTop,
  radiusBottom: rBottom,
  height: h,
  position: [0, y0 + h / 2, 0],
  tone,
});

/**
 * Derives a distinct model from the type's behavior (ADR-0014: the schema holds no mesh data)
 * and scales it to the type's footprint and height, so edited instances stay in proportion.
 */
export function equipmentParts(
  type: Pick<EquipmentType, 'behavior' | 'footprint' | 'height'>,
): Part[] {
  const { width: w, length: l } = type.footprint;
  const h = type.height;
  switch (type.behavior) {
    case 'workstation': {
      // Cabinet with a machine block on top and a signal tower: a manned work cell.
      const cab = h * 0.55;
      const mach = h * 0.35;
      const tr = Math.min(w, l) * 0.04; // by the shorter side so it fits narrow footprints
      const tower = cyl(tr, tr, h - cab, cab, 0.5);
      return [
        slab(w, cab, l, 0, 0, 0, 0.85),
        slab(w * 0.6, mach, l * 0.6, cab, 0, l * 0.1, 1.1),
        { ...tower, position: [w * 0.4, tower.position[1], -l * 0.35] },
      ];
    }
    case 'buffer': {
      // Open rack: four posts, three shelves, a crate on each shelf.
      const post = Math.min(w, l) * 0.08;
      const parts: Part[] = [];
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          parts.push(slab(post, h, post, 0, sx * (w / 2 - post / 2), sz * (l / 2 - post / 2), 0.6));
      const t = h * 0.04;
      for (const f of [0.1, 0.45, 0.8]) {
        const y = h * f;
        parts.push(slab(w, t, l, y, 0, 0, 0.9));
        parts.push(slab(w * 0.6, h * 0.14, l * 0.6, y + t, 0, 0, 1.2));
      }
      return parts;
    }
    case 'conveyor': {
      // Long low belt on legs with side rails; long and thin where the others are blocky.
      const rail = w * 0.12;
      const belt = h * 0.12;
      const legH = h - belt - h * 0.1;
      // Keep the legs (thickness `rail` along z) inside the footprint on short, wide belts.
      const legZ = Math.min(0.45 * l, l / 2 - rail / 2);
      const parts: Part[] = [slab(w - 2 * rail, belt, l, legH, 0, 0, 0.55)];
      for (const s of [-1, 1])
        parts.push(slab(rail, h - legH, l, legH, s * (w / 2 - rail / 2), 0, 1));
      for (const s of [-1, 1])
        for (const z of [-legZ, legZ])
          parts.push(slab(rail, legH, rail, 0, s * (w / 2 - rail / 2), z, 0.7));
      return parts;
    }
    case 'source': {
      // Pallet, round drum and a funnel: material goes in at the top, out at the base.
      const r = Math.min(w, l) / 2;
      const pal = h * 0.1;
      const drum = h * 0.5;
      return [
        slab(w, pal, l, 0, 0, 0, 0.7),
        cyl(r * 0.8, r * 0.8, drum, pal, 1),
        cyl(r * 0.95, r * 0.8, h - pal - drum, pal + drum, 1.2),
      ];
    }
    case 'sink': {
      // Shipping: an open container with a dark mouth, and a stack of pallets waiting beside it.
      const base = h * 0.1;
      const lip = h * 0.02;
      const bodyTop = h - lip;
      const parts: Part[] = [
        slab(w, base, l, 0, 0, 0, 0.7),
        slab(w * 0.6, bodyTop - base, l * 0.9, base, -w * 0.2, 0, 1),
        slab(w * 0.5, lip, l * 0.75, bodyTop, -w * 0.2, 0, 0.2),
      ];
      const pallet = h * 0.12;
      for (let i = 0; i < 3; i++)
        parts.push(
          slab(w * 0.3, pallet, l * 0.6, base + i * pallet, w * 0.3, 0, i % 2 ? 0.9 : 0.6),
        );
      return parts;
    }
  }
}

/** Axis-aligned bounds of all parts (cylinders by their bounding box). */
export function partBounds(parts: Part[]): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const p of parts) {
    const r = p.shape === 'cylinder' ? Math.max(p.radiusTop, p.radiusBottom) : 0;
    const half: Vec3 =
      p.shape === 'box' ? [p.size[0] / 2, p.size[1] / 2, p.size[2] / 2] : [r, p.height / 2, r];
    for (let i = 0; i < 3; i++) {
      min[i] = Math.min(min[i]!, p.position[i]! - half[i]!);
      max[i] = Math.max(max[i]!, p.position[i]! + half[i]!);
    }
  }
  return { min, max };
}

/** Footprint-independent description of a shape's structure, for telling shapes apart. */
export function shapeSignature(parts: Part[]): string {
  return parts
    .map((p) => (p.shape === 'box' ? 'b' : p.radiusTop === p.radiusBottom ? 'c' : 'f'))
    .join('');
}
