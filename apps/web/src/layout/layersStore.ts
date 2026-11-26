import { createStore, type StoreApi, useStore } from 'zustand';
export const LAYERS_KEY = 'factory-sim.layers';
type LayersState = { connections: boolean; setConnections: (on: boolean) => void };
export const createLayersStore = (): StoreApi<LayersState> =>
  createStore<LayersState>(() => {
    throw new Error('not implemented');
  });
const store = createLayersStore;
export const useLayersStore = Object.assign(
  <T>(sel: (s: LayersState) => T): T => useStore(store(), sel),
  { getState: (): LayersState => store().getState(), setState: (_p: Partial<LayersState>) => {} },
);
