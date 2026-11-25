/** Design tokens (ADR-0016): one object per theme; CSS reads them as custom properties, 3D and tests import them. */
export type StateName = 'working' | 'starved' | 'blocked' | 'waiting' | 'walking';

export interface StateColor {
  /** Lights, outlines and text. */
  strong: string;
  /** Bars and fills. */
  tint: string;
}

export interface Theme {
  color: {
    bg: string;
    surface: string;
    surface2: string;
    text: string;
    muted: string;
    border: string;
    accent: string;
    accentInk: string;
    danger: string;
    warning: string;
    /** Elevated surface (menus, cards over a panel). */
    raised: string;
    /** Thin outline of panels; stronger than `border`. */
    panelBorder: string;
    /** Accent halo for the active or bottleneck unit (a CSS colour with alpha). */
    glow: string;
  };
  /** The 3D scene (UI-9): three.js reads these, never its own hex values. */
  scene: {
    background: string;
    floor: string;
    grid: string;
    label: string;
    flow: string;
    /** Equipment parts that aren't the equipment's own colour (materials roles frame, accent, dark). */
    parts: { frame: string; accent: string; dark: string };
    /** Light intensities. */
    ambient: number;
    key: number;
  };
  /** Pixels. */
  space: { 1: number; 2: number; 3: number; 4: number; 5: number; 6: number };
  /** Pixels. */
  radius: { sm: number; md: number; lg: number };
  font: {
    family: string;
    mono: string;
    /** Pixels. */
    size: { xs: number; sm: number; md: number; lg: number; xl: number };
  };
  state: Record<StateName, StateColor>;
}

/** The light theme. */
export const light: Theme = {
  color: {
    bg: '#eef0f3',
    surface: '#ffffff',
    surface2: '#f3f5f8',
    text: '#1b1f24',
    muted: '#5b6470',
    border: '#d5dae1',
    accent: '#2f6fde',
    accentInk: '#ffffff',
    danger: '#b42323',
    warning: '#9a6700',
    raised: '#ffffff',
    panelBorder: '#c3cad3',
    glow: 'rgba(47, 111, 222, 0.22)',
  },
  scene: {
    background: '#eef0f3',
    floor: '#f4f5f7',
    grid: '#c3c8d0',
    label: '#374151',
    flow: '#475569',
    parts: { frame: '#8a929c', accent: '#d7dbe0', dark: '#2b2f36' },
    ambient: 1.2,
    key: 2,
  },
  space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 24, 6: 32 },
  radius: { sm: 4, md: 6, lg: 10 },
  font: {
    family: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    mono: "ui-monospace, 'SFMono-Regular', Menlo, Consolas, monospace",
    size: { xs: 11, sm: 12, md: 14, lg: 18, xl: 24 },
  },
  state: {
    working: { strong: '#1d9a55', tint: '#86d9a0' },
    starved: { strong: '#a87500', tint: '#f6d860' },
    blocked: { strong: '#d43a3a', tint: '#ee8c8c' },
    waiting: { strong: '#8a94a3', tint: '#cfd4dc' },
    walking: { strong: '#7b2fbf', tint: '#c9a6ec' },
  },
};
/**
 * Control-room dark theme (product owner reference): near-black ground, thin teal-tinted panel
 * borders, one teal accent that also drives the glow. State colours are bright enough to read
 * as lights on the dark panel; tints are mid-tone fills for bars and plates.
 */
export const dark: Theme = {
  ...light,
  color: {
    bg: '#080d0e',
    surface: '#0f1719',
    surface2: '#141f21',
    text: '#e3eeed',
    muted: '#8ea5a6',
    border: '#213033',
    accent: '#2fd3b1',
    accentInk: '#04130f',
    danger: '#ff7a73',
    warning: '#f0b429',
    raised: '#1a272a',
    panelBorder: '#2c4246',
    glow: 'rgba(47, 211, 177, 0.35)',
  },
  scene: {
    background: '#070b0c',
    floor: '#0d1416',
    grid: '#1c2d30',
    label: '#b9cecf',
    flow: '#2f9d8a',
    parts: { frame: '#6f7f88', accent: '#b9c6cb', dark: '#161d21' },
    ambient: 0.9,
    key: 1.6,
  },
  state: {
    working: { strong: '#6fdc5b', tint: '#2e8f4a' },
    starved: { strong: '#f2c744', tint: '#b8901d' },
    blocked: { strong: '#f0605a', tint: '#b8433f' },
    waiting: { strong: '#8a97a8', tint: '#566272' },
    walking: { strong: '#b58cff', tint: '#7a52c7' },
  },
};
export const themes = { dark, light } as const;
export type ThemeMode = keyof typeof themes;
/** Static default for code outside React; reactive code uses `getTheme`/`useTheme` (themeStore). */
export const tokens: Theme = dark;

const px = (n: number) => `${n}px`;

/** The theme as `--group-name` → CSS value. Strong state colours are `--state-<name>`, tints `--state-<name>-tint`. */
export function cssVariables(theme: Theme = tokens): Record<string, string> {
  const vars: Record<string, string> = {};
  const kebab = (k: string) => k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`);
  for (const [k, v] of Object.entries(theme.color)) vars[`--color-${kebab(k)}`] = v;
  // Colours only: light intensities are numbers for three.js, and parts is nested.
  for (const [k, v] of Object.entries(theme.scene))
    if (typeof v === 'string') vars[`--scene-${kebab(k)}`] = v;
  for (const [k, v] of Object.entries(theme.scene.parts)) vars[`--scene-part-${k}`] = v;
  for (const [k, v] of Object.entries(theme.space)) vars[`--space-${k}`] = px(v);
  for (const [k, v] of Object.entries(theme.radius)) vars[`--radius-${k}`] = px(v);
  for (const [k, v] of Object.entries(theme.font.size)) vars[`--font-size-${k}`] = px(v);
  vars['--font-family'] = theme.font.family;
  vars['--font-mono'] = theme.font.mono;
  for (const [k, v] of Object.entries(theme.state)) {
    vars[`--state-${k}`] = v.strong;
    vars[`--state-${k}-tint`] = v.tint;
  }
  return vars;
}

/** Writes the theme's custom properties to `root` (the document element at startup). */
export function applyTokens(root: HTMLElement, theme: Theme = tokens): void {
  for (const [name, value] of Object.entries(cssVariables(theme)))
    root.style.setProperty(name, value);
}
