import { create } from 'zustand';
import { themes, type Theme, type ThemeMode } from './tokens';

export const THEME_KEY = 'factory-sim.theme';

interface ThemeState {
  mode: ThemeMode;
  setMode(mode: ThemeMode): void;
  toggle(): void;
}

export const useThemeStore = create<ThemeState>(() => ({
  mode: 'dark',
  setMode: () => {
    throw new Error('not implemented');
  },
  toggle: () => {
    throw new Error('not implemented');
  },
}));

export const getTheme = (): Theme => themes[useThemeStore.getState().mode];
export const useTheme = (): Theme => themes[useThemeStore((s) => s.mode)];

/** Writes the active theme to `root` (CSS variables + `data-theme`) now and on every change; returns the unsubscribe. */
export function startThemeSync(_root: HTMLElement): () => void {
  throw new Error('not implemented');
}
