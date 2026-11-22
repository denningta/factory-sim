import * as THREE from 'three';

export type ViewMode = '3d' | '2d';

export interface ControlSettings {
  enableRotate: boolean;
  mouseButtons: { MIDDLE: THREE.MOUSE; RIGHT: THREE.MOUSE };
  /** 3D: orbit stops just above the floor so the camera never goes underneath. */
  maxPolarAngle: number;
  /** Perspective dolly limits in meters from the target (3D). */
  minDistance: number;
  maxDistance: number;
  /** Orthographic zoom limits in pixels per meter (2D). */
  minZoom: number;
  maxZoom: number;
}

/** The fitted pose the limits scale from: perspective distance (m) and ortho zoom (px/m). */
export interface FitScale {
  distance: number;
  zoom: number;
}

/** Closest dolly-in / furthest dolly-out, as multiples of the fitted distance. */
const NEAR = 0.05;
const FAR = 4;

/**
 * Which OrbitControls gestures and limits each view uses. The left button is reserved for
 * selecting and dragging equipment; the wheel always zooms. 2D is locked top-down, so the right
 * button pans. Limits scale with the fitted pose so very large (or small) floors still fit.
 *
 * 2D must not set maxPolarAngle: with camera up = -z, straight down sits at polar π/2 in
 * OrbitControls' frame, so any clamp below π tilts the view.
 */
export function controlSettings(mode: ViewMode, fit: FitScale): ControlSettings {
  const { MOUSE } = THREE;
  const limits = {
    minDistance: fit.distance * NEAR,
    maxDistance: fit.distance * FAR,
    minZoom: fit.zoom / FAR,
    maxZoom: fit.zoom / NEAR,
  };
  return mode === '3d'
    ? {
        ...limits,
        enableRotate: true,
        mouseButtons: { MIDDLE: MOUSE.PAN, RIGHT: MOUSE.ROTATE },
        maxPolarAngle: Math.PI / 2 - 0.05,
      }
    : {
        ...limits,
        enableRotate: false,
        mouseButtons: { MIDDLE: MOUSE.PAN, RIGHT: MOUSE.PAN },
        maxPolarAngle: Math.PI,
      };
}
