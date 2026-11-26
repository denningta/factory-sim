import { create } from 'zustand';
import { useEditorStore } from '../layout/editorStore';
import { currentProject } from './currentProject';
import { createRunSession, type RunSessionResult } from './runSession';
import { fromProjectRun, toRunOptions } from './runSettings';

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
  /** Saved run settings: undoing an Apply makes the run on screen stale too. */
  run: unknown;
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
  const s = useEditorStore.getState();
  return {
    floor: s.floor,
    equipment: s.equipment,
    products: s.products,
    connections: s.connections,
    cycleTimes: s.cycleTimes,
    technicians: s.technicians,
    demand: s.demand,
    release: s.release,
    shiftLength: s.shiftLength,
    run: s.run,
  };
};

export const isStale = (entry: RunEntry): boolean => {
  const now = modelRefs();
  return (Object.keys(now) as (keyof ModelRefs)[]).some((k) => now[k] !== entry.model[k]);
};

export const useSessionStore = create<SessionState>((set, get) => {
  const start = (options: { warmUp: number; runLength: number }, seed: number) => {
    const result = createRunSession(currentProject(), { ...options, seed });
    // A model that can't run isn't a run: keep the count, show the issues.
    const number = result.ok ? get().count + 1 : get().count;
    set({
      count: number,
      current: { number, settings: { ...options, seed }, result, model: modelRefs() },
    });
  };
  return {
    count: 0,
    current: null,
    startRun: () => {
      const e = useEditorStore.getState();
      const { options, seed } = toRunOptions(fromProjectRun(e.run), e.shiftLength);
      start(options, seed);
    },
    startRunWith: (options, seed) => start(options, seed),
    resetRun: () => {
      const { current, count } = get();
      if (!current?.result.ok) return;
      current.result.session.reset();
      set({ count: count + 1, current: { ...current, number: count + 1 } });
    },
    ensureFreshRun: () => {
      const { current } = get();
      if (!current || isStale(current)) get().startRun();
    },
  };
});
