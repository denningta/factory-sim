import { describe, expect, it } from 'vitest';
import { applyTokens, cssVariables, dark, light, type StateName } from './tokens';

const STATES: StateName[] = ['working', 'starved', 'blocked', 'waiting', 'walking'];

describe('UI-1 AC1: one token module', () => {
  it('defines surfaces, text, muted text, border, accent, danger, spacing, radius and type scale', () => {
    for (const k of [
      'bg',
      'surface',
      'surface2',
      'text',
      'muted',
      'border',
      'accent',
      'danger',
    ] as const)
      expect(dark.color[k]).toMatch(/^#[0-9a-f]{6}$/i);
    expect(Object.keys(dark.space).length).toBeGreaterThanOrEqual(4);
    expect(Object.keys(dark.radius).length).toBeGreaterThanOrEqual(2);
    expect(Object.keys(dark.font.size).length).toBeGreaterThanOrEqual(4);
  });

  it('gives each state (working, starved, blocked, waiting, walking) a strong value and a tint', () => {
    expect(Object.keys(dark.state).sort()).toEqual([...STATES].sort());
    for (const s of STATES) {
      expect(dark.state[s].strong).toMatch(/^#[0-9a-f]{6}$/i);
      expect(dark.state[s].tint).toMatch(/^#[0-9a-f]{6}$/i);
      expect(dark.state[s].tint).not.toBe(dark.state[s].strong);
    }
  });

  it('uses the wireframe palette for the light strong state colours', () => {
    expect(light.state.working.strong).toBe('#1d9a55');
    expect(light.state.starved.strong).toBe('#a87500');
    expect(light.state.blocked.strong).toBe('#d43a3a');
    expect(light.state.waiting.strong).toBe('#8a94a3');
    expect(light.state.walking.strong).toBe('#7b2fbf');
  });

  it('applies the tokens as CSS custom properties on the root', () => {
    const root = document.createElement('div');
    applyTokens(root);
    const vars = cssVariables(dark);
    expect(Object.keys(vars).length).toBeGreaterThan(20);
    for (const [name, value] of Object.entries(vars)) {
      expect(name.startsWith('--')).toBe(true);
      expect(root.style.getPropertyValue(name)).toBe(value);
    }
    expect(Object.values(vars).some((v) => v.includes('[object'))).toBe(false);
    expect(vars['--scene-part-frame']).toBe(dark.scene.parts.frame);
    expect(vars['--scene-ambient']).toBeUndefined();
    expect(root.style.getPropertyValue('--color-accent')).toBe(dark.color.accent);
    expect(root.style.getPropertyValue('--state-working')).toBe(dark.state.working.strong);
    expect(root.style.getPropertyValue('--state-working-tint')).toBe(dark.state.working.tint);
  });
});
