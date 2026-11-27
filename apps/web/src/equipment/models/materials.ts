import * as THREE from 'three';
import type { MaterialRole } from './types';
import { getTheme } from '../../ui/themeStore';

export interface RoleSpec {
  /** Ignored for `body`, which takes the equipment's color. */
  color: string;
  roughness: number;
  metalness: number;
  opacity?: number;
  emissive?: string;
}

/** The one material set every model is drawn with. */
export const ROLE_SPECS: Record<MaterialRole, RoleSpec> = {
  frame: { color: '#8a929c', roughness: 0.5, metalness: 0.6 },
  body: { color: '#ffffff', roughness: 0.6, metalness: 0.1 },
  accent: { color: '#d7dbe0', roughness: 0.4, metalness: 0.3 },
  dark: { color: '#2b2f36', roughness: 0.8, metalness: 0.2 },
  glass: { color: '#a9d4ec', roughness: 0.1, metalness: 0, opacity: 0.4 },
  screen: { color: '#1e3a5f', roughness: 0.3, metalness: 0, emissive: '#1d4ed8' },
};

/** How far the body moves from the equipment's colour toward the theme's pale (SF-8). */
const BODY_PALE = 0.65;
const mixed = new THREE.Color();

/**
 * A part's base color: `body` is the equipment's colour toned toward the theme's pale accent
 * (pale, low-contrast equipment with the colour as a tint, per the control-room reference); the
 * other roles follow the active theme or keep their own.
 */
export function roleColor(role: MaterialRole, bodyColor: string): string {
  // Theme-owned roles follow the active theme; the rest keep their fixed colour.
  const parts = getTheme().scene.parts;
  if (role === 'body') {
    return '#' + mixed.set(bodyColor).lerp(new THREE.Color(parts.accent), BODY_PALE).getHexString();
  }
  return role === 'frame' || role === 'accent' || role === 'dark'
    ? parts[role]
    : ROLE_SPECS[role].color;
}

const cache = new Map<MaterialRole, THREE.MeshStandardMaterial>();

/**
 * The shared material of a role. Its color is white: the part's color comes from the instance
 * color (`roleColor`, tinted for selection), so one material serves every equipment and view.
 * Shared for the app's lifetime; never dispose it.
 */
export function roleMaterial(role: MaterialRole): THREE.MeshStandardMaterial {
  let m = cache.get(role);
  if (!m) {
    const s = ROLE_SPECS[role];
    m = new THREE.MeshStandardMaterial({
      color: '#ffffff',
      roughness: s.roughness,
      metalness: s.metalness,
      ...(s.opacity !== undefined ? { transparent: true, opacity: s.opacity } : {}),
      ...(s.emissive ? { emissive: s.emissive, emissiveIntensity: 0.4 } : {}),
    });
    cache.set(role, m);
  }
  return m;
}
