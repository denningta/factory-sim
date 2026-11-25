import * as THREE from 'three';

import { getTheme } from '../ui/themeStore';

const FLAGGED = new THREE.Color();
const SELECTED = new THREE.Color();

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
  const { color } = getTheme();
  out.copy(base);
  const flagged = s.overlapping || s.tooClose;
  if (flagged) out.lerp(FLAGGED.set(color.danger), s.overlapping ? 0.85 : 0.5);
  if (s.selected) out.lerp(SELECTED.set(color.accent), flagged ? 0.25 : 0.55);
  return out;
}
