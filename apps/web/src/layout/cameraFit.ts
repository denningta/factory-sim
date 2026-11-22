type Vec3 = [number, number, number];
interface FloorSize {
  width: number;
  length: number;
}

/** Where the three dimension labels sit (plan x, y=0, plan z), sized in meters with the floor. */
export function labelLayout(floor: FloorSize) {
  const textHeight = Math.max(floor.width, floor.length) * 0.035;
  const offset = textHeight * 1.2;
  return {
    textHeight,
    offset,
    widthLabel: [floor.width / 2, 0, -offset] as Vec3,
    lengthLabel: [-offset * 2, 0, floor.length / 2] as Vec3,
    gridLabel: [floor.width / 2, 0, floor.length + offset] as Vec3,
  };
}

/**
 * Plan-view rectangle holding the floor and all labels. Label text width isn't known here, so
 * the left side reserves 4 text heights each way of the length label's center (the widest
 * label, e.g. "65.62 ft", is about 4 heights wide, so this is 2x its half-width).
 */
export function planBounds(floor: FloorSize) {
  const { textHeight: h, offset } = labelLayout(floor);
  return {
    minX: -2 * offset - 4 * h,
    maxX: floor.width,
    minZ: -offset - h,
    maxZ: floor.length + offset + h,
  };
}

/** Camera elevation: looks down at 45° from the +z side, like the original fixed pose. */
const ELEVATION = Math.PI / 4;
/** Breathing room around the fitted bounds. */
const PAD = 1.05;

/**
 * Smallest distance, along a fixed 45° view direction, at which the floor and its labels fit
 * a perspective camera of the given vertical fov and canvas aspect (width / height).
 * Exact for perspective: each bounds corner constrains the distance separately.
 */
export function fitCamera(opts: FloorSize & { aspect: number; fovDeg: number }): {
  position: Vec3;
  target: Vec3;
  distance: number;
} {
  const b = planBounds(opts);
  const target: Vec3 = [(b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2];
  const u: Vec3 = [0, Math.sin(ELEVATION), Math.cos(ELEVATION)]; // target → camera
  const up: Vec3 = [0, Math.cos(ELEVATION), -Math.sin(ELEVATION)];
  const t = Math.tan((opts.fovDeg * Math.PI) / 360);
  let distance = 0;
  for (const x of [b.minX, b.maxX])
    for (const z of [b.minZ, b.maxZ]) {
      const q: Vec3 = [x - target[0], 0, z - target[2]];
      const along = q[1] * u[1] + q[2] * u[2]; // q · u
      const screenY = Math.abs(q[1] * up[1] + q[2] * up[2]);
      const screenX = Math.abs(q[0]);
      distance = Math.max(
        distance,
        along + (PAD * screenY) / t,
        along + (PAD * screenX) / (t * opts.aspect),
      );
    }
  return {
    distance,
    target,
    position: [target[0] + u[0] * distance, u[1] * distance, target[2] + u[2] * distance],
  };
}
