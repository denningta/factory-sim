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

/** What the camera needs of a piece of equipment: where it stands and how big it is (m, rad). */
export interface PlacedBox {
  position: { x: number; y: number };
  footprint: { width: number; length: number };
  rotation: number;
  height: number;
}

/** Corners of every footprint at the floor and at the equipment's height (plan y → three z). */
export function equipmentPoints(equipment: readonly PlacedBox[]): Vec3[] {
  const out: Vec3[] = [];
  for (const e of equipment) {
    const c = Math.cos(e.rotation);
    const s = Math.sin(e.rotation);
    const hw = e.footprint.width / 2;
    const hl = e.footprint.length / 2;
    for (const [u, v] of [
      [-hw, -hl],
      [hw, -hl],
      [hw, hl],
      [-hw, hl],
    ] as const)
      for (const y of [0, e.height])
        out.push([e.position.x + u * c - v * s, y, e.position.y + u * s + v * c]);
  }
  return out;
}

/** The default isometric-style view: 35° above the floor, from the +x/+z corner (45° azimuth). */
const ELEVATION = (35 * Math.PI) / 180;
const AZIMUTH = Math.PI / 4;
/** Breathing room around the fitted bounds. */
const PAD = 1.05;
/** Equipment gets more room: callout cards, labels and floating panels sit around it. */
const EQUIPMENT_PAD = 1.25;

/**
 * Smallest distance, along the fixed isometric view direction, at which the equipment (or, with
 * none, the floor and its labels) fits a perspective camera of the given vertical fov and canvas
 * aspect (width / height). Exact for perspective: each point constrains the distance separately.
 * The view is centred on the middle of the points' screen-space extent.
 */
export function fitCamera(
  opts: FloorSize & { aspect: number; fovDeg: number; equipment?: readonly PlacedBox[] },
): {
  position: Vec3;
  target: Vec3;
  distance: number;
} {
  let points: Vec3[];
  let pad = PAD;
  if (opts.equipment && opts.equipment.length > 0) {
    points = equipmentPoints(opts.equipment);
    pad = EQUIPMENT_PAD;
  } else {
    const b = planBounds(opts);
    points = [b.minX, b.maxX].flatMap((x) => [b.minZ, b.maxZ].map((z): Vec3 => [x, 0, z]));
  }
  // Camera basis: u points target → camera, right and up span the screen.
  const u: Vec3 = [
    Math.cos(ELEVATION) * Math.sin(AZIMUTH),
    Math.sin(ELEVATION),
    Math.cos(ELEVATION) * Math.cos(AZIMUTH),
  ];
  const right: Vec3 = [Math.cos(AZIMUTH), 0, -Math.sin(AZIMUTH)];
  const up: Vec3 = [
    -Math.sin(ELEVATION) * Math.sin(AZIMUTH),
    Math.cos(ELEVATION),
    -Math.sin(ELEVATION) * Math.cos(AZIMUTH),
  ];
  const dot = (a: Vec3, b: Vec3) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  // Aim at the centre of the screen-space extent so the framing is balanced.
  const xs = points.map((p) => dot(p, right));
  const ys = points.map((p) => dot(p, up));
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const zs = points.map((p) => dot(p, u));
  const cz = (Math.min(...zs) + Math.max(...zs)) / 2;
  const target: Vec3 = [
    cx * right[0] + cy * up[0] + cz * u[0],
    cx * right[1] + cy * up[1] + cz * u[1],
    cx * right[2] + cy * up[2] + cz * u[2],
  ];
  const t = Math.tan((opts.fovDeg * Math.PI) / 360);
  let distance = 0;
  for (const p of points) {
    const q: Vec3 = [p[0] - target[0], p[1] - target[1], p[2] - target[2]];
    const along = dot(q, u);
    distance = Math.max(
      distance,
      along + (pad * Math.abs(dot(q, up))) / t,
      along + (pad * Math.abs(dot(q, right))) / (t * opts.aspect),
    );
  }
  return {
    distance,
    target,
    position: [
      target[0] + u[0] * distance,
      target[1] + u[1] * distance,
      target[2] + u[2] * distance,
    ],
  };
}

/** Canvas aspect for fitCamera, or null while the canvas has no usable size (0×0, NaN). */
export function aspectOf(size: { width: number; height: number }): number | null {
  const aspect = size.width / size.height;
  return size.width > 0 && size.height > 0 && Number.isFinite(aspect) ? aspect : null;
}

/**
 * Top-down orthographic pose framing the floor and labels in a viewport of the given pixel
 * size. Camera `up` must be (0, 0, -1) so plan +y points down the screen. `zoom` is pixels per
 * meter, matching a frustum sized in pixels (what three/fiber gives an ortho camera).
 */
export function fitOrtho(opts: FloorSize & { viewport: { width: number; height: number } }): {
  position: Vec3;
  target: Vec3;
  zoom: number;
} {
  const b = planBounds(opts);
  const target: Vec3 = [(b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2];
  const zoom = Math.min(
    opts.viewport.width / (b.maxX - b.minX),
    opts.viewport.height / (b.maxZ - b.minZ),
  );
  return { target, position: [target[0], 100, target[2]], zoom: zoom / PAD };
}

/** What the orbit limits scale from; a placeholder canvas size stands in while it is 0×0. */
export function fitScale(
  floor: FloorSize,
  size: { width: number; height: number },
): { distance: number; zoom: number } {
  const usable = aspectOf(size) !== null;
  const viewport = usable ? size : { width: 800, height: 600 };
  return {
    distance: fitCamera({ ...floor, aspect: viewport.width / viewport.height, fovDeg: 45 })
      .distance,
    zoom: fitOrtho({ ...floor, viewport }).zoom,
  };
}
