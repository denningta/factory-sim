import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { MATERIAL_ROLES } from './types';
import { dark } from '../../ui/tokens';
import { ROLE_SPECS, roleColor, roleMaterial } from './materials';

describe('UI-7 AC2: material roles map to one shared material set', () => {
  it('every role has a spec', () => {
    for (const r of MATERIAL_ROLES) expect(ROLE_SPECS[r]).toBeDefined();
  });

  it("body is the equipment's color toned toward the theme's pale; the other roles keep their own", () => {
    for (const r of MATERIAL_ROLES.filter((x) => x !== 'body')) {
      expect(roleColor(r, '#123456')).toBe(
        r === 'frame' || r === 'accent' || r === 'dark' ? dark.scene.parts[r] : ROLE_SPECS[r].color,
      );
      expect(roleColor(r, '#abcdef')).toBe(roleColor(r, '#123456'));
    }
  });

  it('SF-8: body is pale and low-contrast, yet the equipment colour still shows through', () => {
    const lum = (hex: string) => {
      const c = new THREE.Color(hex);
      return 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b;
    };
    const red = '#d92b2b';
    const body = roleColor('body', red);
    expect(lum(body)).toBeGreaterThan(lum(red)); // paler than the raw colour
    expect(body).not.toBe(roleColor('body', '#2b2bd9')); // still tinted by the equipment colour
    expect(new THREE.Color(body).r).toBeGreaterThan(new THREE.Color(body).b); // hue kept
  });

  it('each role is one shared material instance', () => {
    for (const r of MATERIAL_ROLES) expect(roleMaterial(r)).toBe(roleMaterial(r));
    expect(new Set(MATERIAL_ROLES.map(roleMaterial)).size).toBe(MATERIAL_ROLES.length);
  });
});
