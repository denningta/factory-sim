import { create } from 'zustand';
import { createProject, floorSchema, type Equipment, type Floor } from '@factory-sim/schema';
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
  /** The library type to preview and, with LE-2, to place. Session-only, not a preference. */
  selectedTypeId: string | null;
  selectType: (typeId: string | null) => void;
  /** Placed equipment; part of the project document (meters, radians). */
  equipment: Equipment[];
  /** Ids of the selected equipment; session-only. */
  selectedIds: string[];
  /** Snaps to the grid when enabled; returns null (and places nothing) if off the floor. */
  placeEquipment: (typeId: string, point: Point) => Equipment | null;
  selectEquipment: (id: string, additive: boolean) => void;
  /** Selects equipment whose center lies in the rectangle (meters, any corner order). */
  selectInRect: (a: Point, b: Point, additive: boolean) => void;
  clearSelection: () => void;
  /**
   * Drags the selection: `delta` is relative to `starts` (positions when the drag began). The
   * anchor snaps to the grid and the rest keep their offset from it.
   */
  dragSelected: (starts: Record<string, Point>, anchorId: string, delta: Point) => void;
  /** Adds degrees to every selected item's rotation. */
  rotateSelected: (degrees: number) => void;
  /** Sets every selected item's rotation to a typed angle in degrees. */
  setSelectedRotation: (degrees: number) => void;
  deleteSelected: () => void;
  /** Bumped by "Zoom to fit"; the camera rig refits only when this changes (#57). */
  fitTick: number;
  requestFit: () => void;
}

export interface Point {
  x: number;
  y: number;
}

export function createEditorStore() {
  return create<EditorState>()((set, get) => ({
    ...loadPrefs(),
    floor: createProject().floor,
    selectedTypeId: null,
    selectType: (selectedTypeId) => set({ selectedTypeId }),
    equipment: [],
    selectedIds: [],
    placeEquipment: () => {
      throw new Error('not implemented');
    },
    selectEquipment: () => {
      throw new Error('not implemented');
    },
    selectInRect: () => {
      throw new Error('not implemented');
    },
    clearSelection: () => {
      throw new Error('not implemented');
    },
    dragSelected: () => {
      throw new Error('not implemented');
    },
    rotateSelected: () => {
      throw new Error('not implemented');
    },
    setSelectedRotation: () => {
      throw new Error('not implemented');
    },
    deleteSelected: () => {
      throw new Error('not implemented');
    },
    fitTick: 0,
    requestFit: () => {
      throw new Error('not implemented');
    },
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
