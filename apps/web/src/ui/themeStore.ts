import { create } from 'zustand';
import { applyTokens, themes, type Theme, type ThemeMode } from './tokens';

export const THEME_KEY = 'factory-sim.theme';

/** localStorage can be missing or throw (private windows, blocked site data); the app must still work. */
function load(): ThemeMode {
  try {
    const v = localStorage.getItem(THEME_KEY);
    if (v === 'light' || v === 'dark') return v;
  } catch {
    /* fall through to the default */
  }
  return 'dark';
}

function save(mode: ThemeMode) {
  try {
    localStorage.setItem(THEME_KEY, mode);
  } catch {
    /* choice just won't be remembered */
  }
}

interface ThemeState {
  mode: ThemeMode;
  setMode(mode: ThemeMode): void;
  toggle(): void;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: load(),
  setMode: (mode) => {
    save(mode);
    set({ mode });
  },
  toggle: () => get().setMode(get().mode === 'dark' ? 'light' : 'dark'),
}));

/** The active theme for code outside React (three.js callbacks, tests). */
export const getTheme = (): Theme => themes[useThemeStore.getState().mode];
/** The active theme; re-renders the component when the user switches. */
export const useTheme = (): Theme => themes[useThemeStore((s) => s.mode)];

/** Writes the active theme to `root` (CSS variables + `data-theme`) now and on every change; returns the unsubscribe. */
export function startThemeSync(root: HTMLElement): () => void {
  const apply = (mode: ThemeMode) => {
    root.dataset.theme = mode;
    root.style.colorScheme = mode;
    applyTokens(root, themes[mode]);
  };
  apply(useThemeStore.getState().mode);
  return useThemeStore.subscribe((s, prev) => {
    if (s.mode !== prev.mode) apply(s.mode);
  });
}
