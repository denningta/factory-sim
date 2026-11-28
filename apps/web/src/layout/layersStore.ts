import { createStore, useStore } from 'zustand';

export const LAYERS_KEY = 'factory-sim.layers';

type LayersState = {
  connections: boolean;
  setConnections: (on: boolean) => void;
  shadows: boolean;
  setShadows: (on: boolean) => void;
};

// Per viewer, in this browser only: a view preference, never part of the project document.
// Storage can be missing or blocked, so every access is guarded and the default is on.
function load(): boolean {
  try {
    const v: unknown = JSON.parse(localStorage.getItem(LAYERS_KEY) ?? 'null');
    if (v && typeof v === 'object' && 'connections' in v && typeof v.connections === 'boolean')
      return v.connections;
  } catch {
    /* fall through to the default */
  }
  return true;
}

export const createLayersStore = () =>
  createStore<LayersState>((set) => ({
    shadows: true,
    setShadows: () => {},
    connections: load(),
    setConnections: (connections) => {
      set({ connections });
      try {
        localStorage.setItem(LAYERS_KEY, JSON.stringify({ connections }));
      } catch {
        /* not remembered, still applied */
      }
    },
  }));

const store = createLayersStore();
export const useLayersStore = Object.assign(
  <T>(selector: (s: LayersState) => T): T => useStore(store, selector),
  { getState: store.getState, setState: store.setState },
);
