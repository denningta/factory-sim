/** Direction of the one shadow-casting key light, from the floor towards the light. */
export const KEY_DIRECTION: readonly [number, number, number] = [10, 20, 8];

/** Tallest thing that casts a shadow, in metres; padding so tall equipment is never clipped. */
const MAX_HEIGHT = 4;

export type ShadowFit = {
  position: [number, number, number];
  target: [number, number, number];
  /** Half the side of the (square, orthographic) shadow camera. */
  half: number;
  near: number;
  far: number;
};

/**
 * Fits the directional light's shadow camera around the floor: centred on it, half-extent = half
 * the floor diagonal plus the tallest equipment, so the shadow map's texels are spent on the
 * floor and shadows stay crisp at any floor size.
 */
export function shadowFit(floor: { width: number; length: number }): ShadowFit {
  const target: [number, number, number] = [floor.width / 2, 0, floor.length / 2];
  const halfDiagonal = Math.hypot(floor.width, floor.length) / 2;
  const half = halfDiagonal + MAX_HEIGHT;
  const k = Math.hypot(...KEY_DIRECTION);
  const distance = halfDiagonal + MAX_HEIGHT + 2;
  const position: [number, number, number] = [
    target[0] + (KEY_DIRECTION[0] / k) * distance,
    target[1] + (KEY_DIRECTION[1] / k) * distance,
    target[2] + (KEY_DIRECTION[2] / k) * distance,
  ];
  return { position, target, half, near: 0.5, far: distance + halfDiagonal + MAX_HEIGHT + 2 };
}
