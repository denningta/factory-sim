/// <reference types="vite/client" />
import { describe, expect, it } from 'vitest';
import { shadowFit } from './lighting';

const KEY_DIR = [-12, 22, -4];

function lightAxes() {
  const len = Math.hypot(...KEY_DIR);
  const f = KEY_DIR.map((c) => c / len) as [number, number, number];
  // right = up × f normalised, up2 = f × right
  const r = [f[2], 0, -f[0]];
  const rl = Math.hypot(...r);
  const right = r.map((c) => c / rl) as [number, number, number];
  const up: [number, number, number] = [
    f[1] * right[2] - f[2] * right[1],
    f[2] * right[0] - f[0] * right[2],
    f[0] * right[1] - f[1] * right[0],
  ];
  return { f, right, up };
}
const dot = (a: number[], b: number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;

describe('UI-12 AC2: the shadow camera is fitted to the floor', () => {
  for (const floor of [
    { width: 30, length: 20 },
    { width: 80, length: 50 },
  ]) {
    it(`covers every floor corner and the tallest equipment (${floor.width}×${floor.length})`, () => {
      const fit = shadowFit(floor);
      const { f, right, up } = lightAxes();
      const rel = (p: number[]) => [
        p[0]! - fit.position[0],
        p[1]! - fit.position[1],
        p[2]! - fit.position[2],
      ];
      for (const x of [0, floor.width])
        for (const z of [0, floor.length])
          for (const y of [0, 4]) {
            const d = rel([x, y, z]);
            expect(Math.abs(dot(d, right))).toBeLessThanOrEqual(fit.half);
            expect(Math.abs(dot(d, up))).toBeLessThanOrEqual(fit.half);
            const depth = -dot(d, f); // distance along the light's view direction
            expect(depth).toBeGreaterThan(fit.near);
            expect(depth).toBeLessThan(fit.far);
          }
    });
    it('is tight: not more than ~1.5× the floor diagonal, so shadows stay crisp', () => {
      expect(shadowFit(floor).half * 2).toBeLessThanOrEqual(
        Math.hypot(floor.width, floor.length) * 1.5,
      );
    });
  }
  it('aims the light at the floor centre along the key direction', () => {
    const fit = shadowFit({ width: 30, length: 20 });
    expect(fit.target).toEqual([15, 0, 10]);
    const d = fit.position.map((p, i) => p - fit.target[i]!);
    const len = Math.hypot(...d);
    const k = Math.hypot(...KEY_DIR);
    d.forEach((c, i) => expect(c / len).toBeCloseTo(KEY_DIR[i]! / k, 5));
  });
});

describe('UI-12 AC2: scene wiring (soft shadows, casters, receiver)', () => {
  const src = import.meta.glob<string>(
    ['./FloorScene.tsx', './EquipmentLayer.tsx', '../simulation/{PartLayer,TechLayer,CureRig}.tsx'],
    { as: 'raw', eager: true },
  );
  const get = (name: string) => Object.entries(src).find(([k]) => k.endsWith(name))![1];
  it('enables PCF soft shadows on the Canvas, gated by the Shadows layer', () => {
    const t = get('FloorScene.tsx');
    expect(t).toMatch(/shadows=\{[^}]*PCFSoft|PCFSoftShadowMap/);
    expect(t).toMatch(/s\.shadows|\.shadows\b/);
  });
  it('has exactly one shadow-casting directional light, fitted by shadowFit', () => {
    const t = get('FloorScene.tsx');
    expect(
      (
        t.match(/<directionalLight[^>]*castShadow|<directionalLight\s[^>]*\n?[^>]*castShadow/g) ??
        []
      ).length,
    ).toBe(1);
    expect(t).toContain('shadowFit');
  });
  it('the floor receives shadows', () => {
    expect(get('FloorScene.tsx')).toMatch(/shadowMaterial|receiveShadow/);
  });
  it.each(['EquipmentLayer.tsx', 'PartLayer.tsx', 'TechLayer.tsx', 'CureRig.tsx'])(
    '%s casts shadows',
    (f) => {
      expect(get(f)).toMatch(/castShadow/);
    },
  );
});
