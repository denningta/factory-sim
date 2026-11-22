export type ViewMode = '3d' | '2d';

export interface ControlSettings {
  enableRotate: boolean;
  /** three.js MOUSE codes: 0 rotate, 1 dolly, 2 pan. */
  mouseButtons: { MIDDLE: number; RIGHT: number };
}

/** Which OrbitControls gestures each view allows. */
export function controlSettings(_mode: ViewMode): ControlSettings {
  throw new Error('not implemented');
}
