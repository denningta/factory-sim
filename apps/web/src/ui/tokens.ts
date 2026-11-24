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

// Stub until implemented.
export const light: Theme = undefined as unknown as Theme;
export const tokens: Theme = light;

/** The theme as `--group-name` → CSS value. */
export function cssVariables(_theme: Theme = tokens): Record<string, string> {
  throw new Error('not implemented');
}

/** Writes the theme's custom properties to `root` (the document element at startup). */
export function applyTokens(_root: HTMLElement, _theme: Theme = tokens): void {
  throw new Error('not implemented');
}
