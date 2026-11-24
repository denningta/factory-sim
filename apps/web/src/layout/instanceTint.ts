import * as THREE from 'three';

const FLAGGED = new THREE.Color('#dc2626');
const SELECTED = new THREE.Color('#2563eb');

export interface TintState {
  overlapping: boolean;
  tooClose: boolean;
  selected: boolean;
}

/**
 * Writes an instance's final color into `out` (starting from its base color). Flags blend
 * toward red; a selected flagged item gets a lighter blue so the red stays visible.
 */
export function instanceTint(base: THREE.Color, s: TintState, out = new THREE.Color()) {
  out.copy(base);
  const flagged = s.overlapping || s.tooClose;
  if (flagged) out.lerp(FLAGGED, s.overlapping ? 0.85 : 0.5);
  if (s.selected) out.lerp(SELECTED, flagged ? 0.25 : 0.55);
  return out;
}
