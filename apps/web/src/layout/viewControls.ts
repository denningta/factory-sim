export type ViewMode = '3d' | '2d';

export interface ControlSettings {
  enableRotate: boolean;
  /** three.js MOUSE codes: 0 rotate, 1 dolly, 2 pan. */
  mouseButtons: { MIDDLE: number; RIGHT: number };
}

/**
 * Which OrbitControls gestures each view allows. The left button is reserved for selecting and
 * dragging equipment; the wheel always zooms. 2D is locked top-down, so the right button pans.
 */
export function controlSettings(mode: ViewMode): ControlSettings {
  return mode === '3d'
    ? { enableRotate: true, mouseButtons: { MIDDLE: 2, RIGHT: 0 } }
    : { enableRotate: false, mouseButtons: { MIDDLE: 2, RIGHT: 2 } };
}
