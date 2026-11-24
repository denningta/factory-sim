/// <reference types="vite/client" />
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectList } from '../projects/ProjectList';
import { roleColor } from '../equipment/models/materials';
import { plateColor } from '../simulation/stationStatus';
import { dark, light, themes, type StateName, type Theme } from './tokens';
import { getTheme, startThemeSync, THEME_KEY, useThemeStore } from './themeStore';

const STATES: StateName[] = ['working', 'starved', 'blocked', 'waiting', 'walking'];

function shape(o: unknown): unknown {
  return o && typeof o === 'object'
    ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, shape(v)]))
    : typeof o;
}

beforeEach(() => {
  localStorage.clear();
  useThemeStore.setState({ mode: 'dark' });
  document.documentElement.removeAttribute('data-theme');
});
afterEach(cleanup);

describe('UI-9 AC1: dark and light themes with the same keys', () => {
  it('has the same keys in both themes, including glow, panel border and raised surface', () => {
    expect(shape(dark)).toEqual(shape(light));
    for (const t of [dark, light]) {
      expect(t.color.glow).toBeTruthy();
      expect(t.color.panelBorder).toMatch(/^#[0-9a-f]{6}$/i);
      expect(t.color.raised).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('dark is a real control-room palette: near-black background, dark panels, teal accent', () => {
    expect(lum(dark.color.bg)).toBeLessThan(0.01);
    expect(lum(dark.color.surface)).toBeLessThan(0.03);
    const [r, g, b] = rgb(dark.color.accent);
    expect(g).toBeGreaterThan(r + 60);
    expect(b).toBeGreaterThan(r + 40);
    expect(lum(light.color.bg)).toBeGreaterThan(0.5);
  });
});

describe('UI-9 AC2: theme toggle', () => {
  const api = {
    listProjects: async () => [],
    createProject: vi.fn(),
    renameProject: vi.fn(),
    deleteProject: vi.fn(),
  };

  it('a new browser starts dark', () => {
    expect(useThemeStore.getState().mode).toBe('dark');
    expect(getTheme()).toBe(dark);
  });

  it('switches the whole app without a reload and remembers the choice', async () => {
    const stop = startThemeSync(document.documentElement);
    render(<ProjectList api={api} onOpen={() => {}} onAccount={() => {}} />);
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(document.documentElement.style.getPropertyValue('--color-bg')).toBe(dark.color.bg);
    await userEvent.click(screen.getByRole('button', { name: /light theme/i }));
    expect(document.documentElement.dataset.theme).toBe('light');
    expect(document.documentElement.style.getPropertyValue('--color-bg')).toBe(light.color.bg);
    expect(document.documentElement.style.getPropertyValue('--scene-background')).toBe(
      light.scene.background,
    );
    expect(localStorage.getItem(THEME_KEY)).toBe('light');
    await userEvent.click(screen.getByRole('button', { name: /dark theme/i }));
    expect(document.documentElement.dataset.theme).toBe('dark');
    stop();
  });

  it('restores a saved choice, and survives localStorage throwing', async () => {
    localStorage.setItem(THEME_KEY, 'light');
    vi.resetModules();
    const fresh = await import('./themeStore');
    expect(fresh.useThemeStore.getState().mode).toBe('light');
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => fresh.useThemeStore.getState().toggle()).not.toThrow();
    expect(fresh.useThemeStore.getState().mode).toBe('dark');
    spy.mockRestore();
  });
});

describe('UI-9 AC3: the 3D scene reads the active theme', () => {
  it('scene tokens differ per theme', () => {
    for (const k of ['background', 'floor', 'grid', 'label', 'flow'] as const)
      expect(dark.scene[k]).not.toBe(light.scene[k]);
  });

  it('equipment material colours and station plates follow the store, with no remount needed', () => {
    const darkDark = roleColor('dark', '#fff');
    const darkPlate = plateColor('working');
    useThemeStore.getState().setMode('light');
    expect(roleColor('dark', '#fff')).not.toBe(darkDark);
    expect(plateColor('working')).not.toBe(darkPlate);
    expect(plateColor('working')).toBe(light.state.working.tint);
  });
});

function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lum(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const ratio = (a: string, b: string) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};
const dist = (a: string, b: string) => {
  const [x, y] = [rgb(a), rgb(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
};

describe.each(Object.entries(themes) as [string, Theme][])('UI-9 AC4: contrast in %s', (_n, t) => {
  const surfaces = [t.color.bg, t.color.surface, t.color.surface2, t.color.raised];
  it('text and muted text are ≥ 4.5:1 on every surface', () => {
    for (const s of surfaces) {
      expect(ratio(t.color.text, s)).toBeGreaterThanOrEqual(4.5);
      expect(ratio(t.color.muted, s)).toBeGreaterThanOrEqual(4.5);
    }
  });
  it('accent ink on the accent and the accent on the panel are readable', () => {
    expect(ratio(t.color.accentInk, t.color.accent)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(t.color.accent, t.color.surface)).toBeGreaterThanOrEqual(3);
  });
  it('each strong state colour is ≥ 3:1 on the panel surface', () => {
    for (const s of STATES)
      expect(ratio(t.state[s].strong, t.color.surface), s).toBeGreaterThanOrEqual(3);
  });
  it('state colours are distinguishable from each other and from the accent', () => {
    for (const a of STATES) {
      expect(dist(t.state[a].strong, t.color.accent), a).toBeGreaterThan(60);
      for (const b of STATES)
        if (a < b)
          expect(dist(t.state[a].strong, t.state[b].strong), `${a}/${b}`).toBeGreaterThan(60);
    }
  });
});

describe('UI-9 AC5: no hard-coded colour in the migrated screens', () => {
  const tsx = import.meta.glob<string>('../{ui,auth,projects,products}/*.tsx', {
    as: 'raw',
    eager: true,
  });
  // Plain `?raw` on a CSS module yields the class map under vitest; `?inline` yields the source.
  const css = import.meta.glob<string>('../{ui,auth,projects,products}/*.css', {
    query: '?inline',
    import: 'default',
    eager: true,
  });
  const files = Object.entries({ ...tsx, ...css }).filter(([f]) => !/\.test\./.test(f));
  it('has no hex or rgb() colour literal in their CSS or TSX', () => {
    expect(files.length).toBeGreaterThan(10);
    const hits = files.flatMap(([f, text]) =>
      text
        .split('\n')
        .filter((l) => /#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(l) && !l.includes('var(--'))
        .map((l) => `${f}: ${l.trim()}`),
    );
    expect(hits).toEqual([]);
  });
});
