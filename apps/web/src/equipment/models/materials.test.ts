import { describe, expect, it } from 'vitest';
import { MATERIAL_ROLES } from './types';
import { dark } from '../../ui/tokens';
import { ROLE_SPECS, roleColor, roleMaterial } from './materials';

describe('UI-7 AC2: material roles map to one shared material set', () => {
  it('every role has a spec', () => {
    for (const r of MATERIAL_ROLES) expect(ROLE_SPECS[r]).toBeDefined();
  });

  it("body takes the equipment's color; the other roles keep their own", () => {
    expect(roleColor('body', '#123456')).toBe('#123456');
    for (const r of MATERIAL_ROLES.filter((x) => x !== 'body')) {
      expect(roleColor(r, '#123456')).toBe(
        r === 'frame' || r === 'accent' || r === 'dark' ? dark.scene.parts[r] : ROLE_SPECS[r].color,
      );
      expect(roleColor(r, '#abcdef')).toBe(roleColor(r, '#123456'));
    }
  });

  it('each role is one shared material instance', () => {
    for (const r of MATERIAL_ROLES) expect(roleMaterial(r)).toBe(roleMaterial(r));
    expect(new Set(MATERIAL_ROLES.map(roleMaterial)).size).toBe(MATERIAL_ROLES.length);
  });
});
