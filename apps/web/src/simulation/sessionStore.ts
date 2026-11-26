import { create } from 'zustand';
import type { RunSessionResult } from './runSession';

/** The editor slices a run was built from; a different reference later means the model changed. */
export interface ModelRefs {
  floor: unknown;
  equipment: unknown;
  products: unknown;
  connections: unknown;
  cycleTimes: unknown;
  technicians: unknown;
  demand: unknown;
  release: unknown;
  shiftLength: number;
}

export interface RunEntry {
  /** Runs started in this session: Apply, Run simulation and Reset each start one. */
  number: number;
  /** Seconds, as the engine got them. */
  settings: { warmUp: number; runLength: number; seed: number };
  result: RunSessionResult;
  model: ModelRefs;
}

interface SessionState {
  count: number;
  current: RunEntry | null;
  /** Builds a session from the editor's model and its saved run settings; a new run. */
  startRun(): void;
  /** Apply: `startRun` with settings just applied (random seed drawn once per Apply). */
  startRunWith(options: { warmUp: number; runLength: number }, seed: number): void;
  /** Reset the current session to time 0; a new run. */
  resetRun(): void;
  /** Starts a run only if none exists or the model changed since it. */
  ensureFreshRun(): void;
}

export const modelRefs = (): ModelRefs => {
  throw new Error('not implemented');
};
export const isStale = (_entry: RunEntry): boolean => {
  throw new Error('not implemented');
};

export const useSessionStore = create<SessionState>(() => ({
  count: 0,
  current: null,
  startRun: () => {
    throw new Error('not implemented');
  },
  startRunWith: () => {
    throw new Error('not implemented');
  },
  resetRun: () => {
    throw new Error('not implemented');
  },
  ensureFreshRun: () => {
    throw new Error('not implemented');
  },
}));
