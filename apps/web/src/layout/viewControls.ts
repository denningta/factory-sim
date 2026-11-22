import * as THREE from 'three';

export type ViewMode = '3d' | '2d';

export interface ControlSettings {
  enableRotate: boolean;
  mouseButtons: { MIDDLE: THREE.MOUSE; RIGHT: THREE.MOUSE };
  /** Perspective only: orbit stops just above the floor so the camera never goes underneath. */
  maxPolarAngle: number;
  /** Perspective dolly limits in meters from the target. */
  minDistance: number;
  maxDistance: number;
  /** Orthographic zoom limits in pixels per meter. */
  minZoom: number;
  maxZoom: number;
}

const LIMITS = {
  maxPolarAngle: Math.PI / 2 - 0.05,
  minDistance: 1,
  maxDistance: 1000,
  minZoom: 0.5,
  maxZoom: 500,
};

/**
 * Which OrbitControls gestures each view allows. The left button is reserved for selecting and
 * dragging equipment; the wheel always zooms. 2D is locked top-down, so the right button pans.
 */
export function controlSettings(mode: ViewMode): ControlSettings {
  const { MOUSE } = THREE;
  return mode === '3d'
    ? {
        ...LIMITS,
        enableRotate: true,
        mouseButtons: { MIDDLE: MOUSE.PAN, RIGHT: MOUSE.ROTATE },
      }
    : {
        ...LIMITS,
        enableRotate: false,
        mouseButtons: { MIDDLE: MOUSE.PAN, RIGHT: MOUSE.PAN },
      };
}
