import { create } from 'zustand';
import { createProject, floorSchema, type Floor } from '@factory-sim/schema';
import { MAX_GRID_LINES } from './gridLayout';
import type { DisplayUnit } from './units';

const PREFS_KEY = 'factory-sim:editor-prefs';

interface Prefs {
  unit: DisplayUnit;
  snapEnabled: boolean;
}

function loadPrefs(): Prefs {
  const defaults: Prefs = { unit: 'ft', snapEnabled: true };
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null');
    if (raw && typeof raw === 'object') {
      const r = raw as Partial<Prefs>;
      return {
        unit: r.unit === 'm' || r.unit === 'ft' ? r.unit : defaults.unit,
        snapEnabled: typeof r.snapEnabled === 'boolean' ? r.snapEnabled : defaults.snapEnabled,
      };
    }
  } catch {
    // Storage unavailable or corrupt: fall back to defaults.
  }
  return defaults;
}

function savePrefs(p: Prefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(p));
  } catch {
    // Preferences are a convenience; ignore failures.
  }
}

export type SetFloorResult = { ok: true } | { ok: false; error: string };

export interface EditorState extends Prefs {
  /** Project document content; always meters (ADR-0006). */
  floor: Floor;
  /** Validates with the schema; on failure the floor is left unchanged. */
  setFloor: (patch: Partial<Floor>) => SetFloorResult;
  /** Display only: does not touch `floor`. */
  setUnit: (unit: DisplayUnit) => void;
  toggleSnap: () => void;
}

export function createEditorStore() {
  return create<EditorState>()((set, get) => ({
    ...loadPrefs(),
    floor: createProject().floor,
    setFloor: (patch) => {
      const next = { ...get().floor, ...patch };
      const parsed = floorSchema.safeParse(next);
      if (!parsed.success) return { ok: false, error: 'Enter a positive number' };
      if (
        parsed.data.width / parsed.data.gridSpacing > MAX_GRID_LINES ||
        parsed.data.length / parsed.data.gridSpacing > MAX_GRID_LINES
      )
        return { ok: false, error: 'Grid spacing is too small for this floor' };
      set({ floor: parsed.data });
      return { ok: true };
    },
    setUnit: (unit) => {
      set({ unit });
      savePrefs({ unit, snapEnabled: get().snapEnabled });
    },
    toggleSnap: () => {
      const snapEnabled = !get().snapEnabled;
      set({ snapEnabled });
      savePrefs({ unit: get().unit, snapEnabled });
    },
  }));
}

export const useEditorStore = createEditorStore();
