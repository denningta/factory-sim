import { createStore, useStore } from 'zustand';

export const LAYERS_KEY = 'factory-sim.layers';

type LayersState = {
  connections: boolean;
  setConnections: (on: boolean) => void;
  shadows: boolean;
  setShadows: (on: boolean) => void;
};

type Stored = { connections: boolean; shadows: boolean };

// Per viewer, in this browser only: view preferences, never part of the project document.
// Storage can be missing or blocked, so every access is guarded and the defaults are on.
function load(): Stored {
  const out = { connections: true, shadows: true };
  try {
    const v: unknown = JSON.parse(localStorage.getItem(LAYERS_KEY) ?? 'null');
    if (v && typeof v === 'object') {
      if ('connections' in v && typeof v.connections === 'boolean') out.connections = v.connections;
      if ('shadows' in v && typeof v.shadows === 'boolean') out.shadows = v.shadows;
    }
  } catch {
    /* fall through to the defaults */
  }
  return out;
}

export const createLayersStore = () =>
  createStore<LayersState>((set, get) => {
    const save = (patch: Partial<Stored>) => {
      set(patch);
      const { connections, shadows } = get();
      try {
        localStorage.setItem(LAYERS_KEY, JSON.stringify({ connections, shadows }));
      } catch {
        /* not remembered, still applied */
      }
    };
    return {
      ...load(),
      setConnections: (connections) => save({ connections }),
      setShadows: (shadows) => save({ shadows }),
    };
  });

const store = createLayersStore();
export const useLayersStore = Object.assign(
  <T>(selector: (s: LayersState) => T): T => useStore(store, selector),
  { getState: store.getState, setState: store.setState },
);
