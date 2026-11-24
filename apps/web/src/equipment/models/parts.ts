import type { MaterialRole, ModelPart, Vec3 } from './types';

/** Radial segments of a cylinder at full detail and at the cheap LOD. */
export const FULL_SEGMENTS = 24;
export const LOW_SEGMENTS = 8;

interface Opts {
  role?: MaterialRole;
  fixed?: boolean;
}

/** A box of height `h` standing on `y0`, centered at (x, z) on the floor plan. */
export function slab(
  w: number,
  h: number,
  l: number,
  y0: number,
  x = 0,
  z = 0,
  { role = 'body', fixed }: Opts = {},
): ModelPart {
  return {
    shape: 'box',
    size: [w, h, l],
    position: [x, y0 + h / 2, z],
    role,
    ...(fixed ? { fixed } : {}),
  };
}

/** A cylinder (or taper) of height `h` standing on `y0`. */
export function cyl(
  rTop: number,
  rBottom: number,
  h: number,
  y0: number,
  x = 0,
  z = 0,
  { role = 'body', fixed, segments = FULL_SEGMENTS }: Opts & { segments?: number } = {},
): ModelPart {
  return {
    shape: 'cylinder',
    radiusTop: rTop,
    radiusBottom: rBottom,
    height: h,
    segments,
    position: [x, y0 + h / 2, z],
    role,
    ...(fixed ? { fixed } : {}),
  };
}

/** Axis-aligned bounds of all parts (cylinders by their bounding box). */
export function partBounds(parts: readonly ModelPart[]): { min: Vec3; max: Vec3 } {
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

/** Triangles three.js generates for the part (BoxGeometry / CylinderGeometry, one height segment). */
export function partTriangles(p: ModelPart): number {
  if (p.shape === 'box') return 12;
  const caps = (p.radiusTop > 0 ? 1 : 0) + (p.radiusBottom > 0 ? 1 : 0);
  return p.segments * (2 + caps);
}

/**
 * What instances must share to be drawn by the same instanced meshes: per part its shape,
 * role, segments and cylinder taper. Sizes and positions are per instance.
 */
export function structureKey(parts: readonly ModelPart[]): string {
  return parts
    .map((p) =>
      p.shape === 'box'
        ? `b:${p.role}`
        : `c:${p.role}:${p.segments}:${+(p.radiusTop / p.radiusBottom).toFixed(6)}`,
    )
    .join(',');
}

/** A real-world size (m), shrunk only so it never takes more than `share` of `available`. */
export const real = (meters: number, available: number, share = 0.5) =>
  Math.min(meters, available * share);

/**
 * Camera distance (m) past which the ported behavior defaults switch to their box LOD. They
 * are cheap at full detail (≤ ~130 triangles), so only a zoomed-out view of a very large
 * floor drops to boxes; the default view of the floor keeps every detail.
 */
export const LOD_DISTANCE = 150;
