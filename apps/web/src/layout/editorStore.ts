import { create } from 'zustand';
import {
  BASE_EQUIPMENT_TYPES,
  createProject,
  equipmentSchema,
  floorSchema,
  projectSchema,
  instantiate,
  type Connection,
  type Equipment,
  type PortRef,
  type Floor,
  type Product,
  type Project,
} from '@factory-sim/schema';
import { dragTargets, idsInRect } from './selection';
import { MAX_GRID_LINES, snapToGrid } from './gridLayout';
import type { DisplayUnit } from './units';
import type { ViewMode } from './viewControls';

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

/** Distinct from the neutral equipment colors so products read as products in the 3D view. */
const PRODUCT_COLORS = ['#2563eb', '#c2410c', '#16a34a', '#9333ea', '#ca8a04', '#db2777'];

const toRadians = (deg: number) => (deg * Math.PI) / 180;
/** Keeps rotations in [0, 2π) so repeated 90° steps don't grow without bound. */
const normalizeRadians = (r: number) => {
  const t = 2 * Math.PI;
  const n = ((r % t) + t) % t;
  return t - n < 1e-9 ? 0 : n;
};

export type SetFloorResult = { ok: true } | { ok: false; error: string };
export type UpdateEquipmentResult =
  | { ok: true }
  | {
      ok: false;
      /** Default (SI) wording; the UI may reformat it from `bounds` in the display unit. */
      error: string;
      /** Set when a position is off the floor: the axis and the floor limit in meters. */
      bounds?: { axis: 'x' | 'y'; max: number };
      /** The params key a schema rule failed on (e.g. `batchSize` when capacity is lowered). */
      field?: string;
    };

/** The properties WS-1 edits. Position is meters; params are validated per behavior. */
export interface EquipmentPatch {
  name?: string;
  position?: Partial<Point>;
  params?: Record<string, number>;
  /** Meters. */
  footprint?: { width?: number; length?: number };
  /** Meters. */
  height?: number;
}

export type ProductResult = { ok: true } | { ok: false; error: string; field?: string };

/** The fields PR-1 edits; the routing is PR-2's. */
export interface ProductPatch {
  partNumber?: string;
  name?: string;
  color?: string;
}

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
  /** End items built on the line; part of the project document. */
  products: Product[];
  /** Adds a product with a unique default part number, name and color. */
  addProduct: () => Product;
  /** Validates with the schema plus part-number uniqueness; on failure nothing changes. */
  updateProduct: (id: string, patch: ProductPatch) => ProductResult;
  deleteProduct: (id: string) => void;
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
  /**
   * Edits one equipment's name, position, size or params. Validates with the schema (plus: name
   * non-blank, position on the floor); on failure nothing changes and the reason is returned.
   */
  updateEquipment: (id: string, patch: EquipmentPatch) => UpdateEquipmentResult;
  /** Adds degrees to every selected item's rotation. */
  rotateSelected: (degrees: number) => void;
  /** Sets every selected item's rotation to a typed angle in degrees. */
  setSelectedRotation: (degrees: number) => void;
  deleteSelected: () => void;
  /** Connections; part of the project document. */
  connections: Connection[];
  selectedConnectionId: string | null;
  /** The output port picked as the start of a connection being drawn; session-only. */
  pendingFrom: PortRef | null;
  /** First click an output (sets `pendingFrom`), then an input (connects). Esc cancels. */
  clickPort: (ref: PortRef) => ConnectResult;
  connect: (from: PortRef, to: PortRef) => ConnectResult;
  selectConnection: (id: string | null) => void;
  /** Session-only edit history (LE-3). */
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  /**
   * Groups every edit until `endEdit` into one undo step (a focused field's keystrokes). An
   * edit session that changed nothing leaves no step. Returns a token for `endEdit`; beginning
   * a new session closes any open one.
   */
  beginEdit: () => number;
  /** Closes the session `token` opened; a no-op if that session already ended or was replaced. */
  endEdit: (token: number) => void;
  /** Bumped by "Zoom to fit"; the camera rig refits only when this changes (#57). */
  fitTick: number;
  /** Replaces the editable content with an opened project's document; session state resets. */
  loadDocument: (doc: Project) => void;
  requestFit: () => void;
  /** 3D perspective or orthographic top-down; session-only. */
  viewMode: ViewMode;
  toggleView: () => void;
}

export type ConnectResult = { ok: true } | { ok: false; error: string };

export const HISTORY_LIMIT = 100;

export interface Point {
  x: number;
  y: number;
}

export function createEditorStore() {
  return create<EditorState>()((set, get) => {
    // History is session-only and snapshots the document content the editor owns. A future
    // connect/disconnect (FL-1) joins by adding `connections` to Snapshot and to loadDocument.
    interface Snapshot {
      floor: Floor;
      equipment: Equipment[];
      products: Product[];
    }
    const snapshot = (): Snapshot => ({
      floor: get().floor,
      equipment: get().equipment,
      products: get().products,
    });
    let past: Snapshot[] = [];
    let future: Snapshot[] = [];
    /** Set between beginEdit and endEdit; `pushed` once its first write took the snapshot. */
    let session: { token: number; before: Snapshot; pushed: boolean } | null = null;
    let nextToken = 0;
    const syncFlags = () => set({ canUndo: past.length > 0, canRedo: future.length > 0 });
    /** Call just before a successful document write; one call per undo step. */
    const record = () => {
      if (session) {
        if (session.pushed) return;
        session.pushed = true;
      }
      past.push(session ? session.before : snapshot());
      if (past.length > HISTORY_LIMIT) past = past.slice(past.length - HISTORY_LIMIT);
      future = [];
      syncFlags();
    };
    const restore = (to: Snapshot) => {
      const ids = new Set(to.equipment.map((e) => e.id));
      set({
        ...to,
        selectedIds: get().selectedIds.filter((id) => ids.has(id)),
        canUndo: past.length > 0,
        canRedo: future.length > 0,
      });
    };
    const mapSelected = (f: (e: Equipment) => Equipment) => {
      const ids = new Set(get().selectedIds);
      if (!get().equipment.some((e) => ids.has(e.id))) return;
      record();
      set({ equipment: get().equipment.map((e) => (ids.has(e.id) ? f(e) : e)) });
    };
    return {
      ...loadPrefs(),
      floor: createProject().floor,
      selectedTypeId: null,
      selectType: (selectedTypeId) => set({ selectedTypeId }),
      equipment: [],
      products: [],
      addProduct: () => {
        const { products } = get();
        const ids = new Set(products.map((p) => p.id));
        const parts = new Set(products.map((p) => p.partNumber));
        // Count up past anything taken so deleting a product never makes a default collide.
        let n = products.length + 1;
        while (ids.has(`prod-${n}`) || parts.has(`P-${n}`)) n++;
        const product: Product = {
          id: `prod-${n}`,
          partNumber: `P-${n}`,
          name: `Product ${n}`,
          color: PRODUCT_COLORS[(n - 1) % PRODUCT_COLORS.length]!,
          routing: [],
        };
        record();
        set({ products: [...products, product] });
        return product;
      },
      updateProduct: (id, patch) => {
        const { products } = get();
        const current = products.find((p) => p.id === id);
        if (!current) return { ok: false, error: 'Product not found' };
        // The schema accepts a whitespace-only name; a blank label is useless in the UI.
        if (patch.name !== undefined && patch.name.trim() === '')
          return { ok: false, field: 'name', error: 'Name cannot be empty' };
        // One rule set: the project schema owns uniqueness and field rules (trimmed part numbers,
        // case-sensitive), so the UI can never accept what a save would reject.
        const candidate = products.map((p) => (p.id === id ? { ...p, ...patch } : p));
        const parsed = projectSchema.safeParse({
          ...createProject(),
          floor: get().floor,
          equipment: get().equipment,
          products: candidate,
        });
        if (!parsed.success) {
          const issue = parsed.error.issues.find((i) => i.path[0] === 'products');
          if (!issue) return { ok: false, error: 'Cannot save this change' };
          {
            const field = String(issue.path[2]);
            const label = { partNumber: 'Part number', name: 'Name' }[field];
            const custom = issue.code === 'custom';
            return {
              ok: false,
              field,
              error: custom
                ? issue.message
                : field === 'color'
                  ? 'Pick a color'
                  : label
                    ? `${label} cannot be empty`
                    : issue.message,
            };
          }
        }
        record();
        set({ products: parsed.data.products });
        return { ok: true };
      },
      deleteProduct: (id) => {
        if (!get().products.some((p) => p.id === id)) return;
        record();
        set({ products: get().products.filter((p) => p.id !== id) });
      },
      selectedIds: [],
      placeEquipment: (typeId, point) => {
        const type = BASE_EQUIPMENT_TYPES.find((t) => t.id === typeId);
        const { floor, snapEnabled, equipment } = get();
        if (!type) return null;
        const p = snapToGrid(point, floor.gridSpacing, snapEnabled);
        if (p.x < 0 || p.y < 0 || p.x > floor.width || p.y > floor.length) return null;
        const taken = new Set(equipment.map((e) => e.id));
        let n = equipment.length + 1;
        while (taken.has(`eq-${n}`)) n++;
        const sameType = equipment.filter((e) => e.typeId === type.id).length + 1;
        const placed = instantiate(type, {
          id: `eq-${n}`,
          name: `${type.name} ${sameType}`,
          position: p,
        });
        record();
        set({ equipment: [...equipment, placed] });
        return placed;
      },
      selectEquipment: (id, additive) => {
        const { selectedIds } = get();
        if (!additive) return set({ selectedIds: [id] });
        set({
          selectedIds: selectedIds.includes(id)
            ? selectedIds.filter((s) => s !== id)
            : [...selectedIds, id],
        });
      },
      selectInRect: (a, b, additive) => {
        const hit = idsInRect(get().equipment, a, b);
        const base = additive ? get().selectedIds : [];
        set({ selectedIds: [...base, ...hit.filter((id) => !base.includes(id))] });
      },
      clearSelection: () => set({ selectedIds: [] }),
      dragSelected: (starts, anchorId, delta) => {
        const { floor, snapEnabled } = get();
        const to = dragTargets(starts, anchorId, delta, {
          spacing: floor.gridSpacing,
          enabled: snapEnabled,
        });
        // A click on an object ends a zero-length drag; it must not leave an empty undo step.
        const moved = get().equipment.some((e) => {
          const p = to[e.id];
          return p && (p.x !== e.position.x || p.y !== e.position.y);
        });
        if (!moved) return;
        record();
        set({
          equipment: get().equipment.map((e) => {
            const p = to[e.id];
            return p ? { ...e, position: p } : e;
          }),
        });
      },
      updateEquipment: (id, patch) => {
        const { equipment, floor } = get();
        const current = equipment.find((e) => e.id === id);
        if (!current) return { ok: false, error: 'Equipment not found' };
        if (patch.name !== undefined && patch.name.trim() === '')
          return { ok: false, error: 'Name cannot be empty' };
        const position = { ...current.position, ...patch.position };
        if (!Number.isFinite(position.x) || !Number.isFinite(position.y))
          return { ok: false, error: 'Enter a number' };
        for (const [axis, max] of [
          ['x', floor.width],
          ['y', floor.length],
        ] as const) {
          if (position[axis] < 0 || position[axis] > max)
            return {
              ok: false,
              error: `${axis.toUpperCase()} must be on the floor (0 to ${max} m)`,
              bounds: { axis, max },
            };
        }
        const next = {
          ...current,
          name: patch.name ?? current.name,
          position,
          params: { ...current.params, ...patch.params },
          footprint: { ...current.footprint, ...patch.footprint },
          height: patch.height ?? current.height,
        };
        // The schema owns the rules (positive ints, batch size <= capacity, no unknown keys).
        const parsed = equipmentSchema.safeParse(next);
        if (!parsed.success) {
          const issue = parsed.error.issues[0]!;
          const field = issue.path[0] === 'params' ? String(issue.path[1]) : undefined;
          const isSize = issue.path[0] === 'footprint' || issue.path[0] === 'height';
          return {
            ok: false,
            error: isSize ? 'Must be greater than 0' : issue.message,
            ...(field ? { field } : {}),
          };
        }
        record();
        set({ equipment: equipment.map((e) => (e.id === id ? parsed.data : e)) });
        return { ok: true };
      },
      rotateSelected: (degrees) => {
        mapSelected((e) => ({ ...e, rotation: normalizeRadians(e.rotation + toRadians(degrees)) }));
      },
      setSelectedRotation: (degrees) => {
        if (!Number.isFinite(degrees)) return;
        mapSelected((e) => ({ ...e, rotation: normalizeRadians(toRadians(degrees)) }));
      },
      deleteSelected: () => {
        const gone = new Set(get().selectedIds);
        if (!get().equipment.some((e) => gone.has(e.id))) return;
        record();
        set({ equipment: get().equipment.filter((e) => !gone.has(e.id)), selectedIds: [] });
      },
      connections: [],
      selectedConnectionId: null,
      pendingFrom: null,
      clickPort: () => {
        throw new Error('not implemented');
      },
      connect: () => {
        throw new Error('not implemented');
      },
      selectConnection: () => {
        throw new Error('not implemented');
      },
      loadDocument: (doc) => {
        past = [];
        future = [];
        session = null;
        set({
          floor: doc.floor,
          equipment: doc.equipment,
          products: doc.products,
          selectedIds: [],
          selectedTypeId: null,
          canUndo: false,
          canRedo: false,
        });
      },
      canUndo: false,
      canRedo: false,
      undo: () => {
        session = null;
        const to = past.pop();
        if (!to) return;
        future.push(snapshot());
        restore(to);
      },
      redo: () => {
        session = null;
        const to = future.pop();
        if (!to) return;
        past.push(snapshot());
        restore(to);
      },
      beginEdit: () => {
        session = { token: ++nextToken, before: snapshot(), pushed: false };
        return session.token;
      },
      endEdit: (token) => {
        if (session?.token === token) session = null;
      },
      fitTick: 0,
      viewMode: '3d',
      toggleView: () => set({ viewMode: get().viewMode === '3d' ? '2d' : '3d' }),
      requestFit: () => set({ fitTick: get().fitTick + 1 }),
      setFloor: (patch) => {
        const next = { ...get().floor, ...patch };
        const parsed = floorSchema.safeParse(next);
        if (!parsed.success) return { ok: false, error: 'Enter a positive number' };
        if (
          parsed.data.width / parsed.data.gridSpacing > MAX_GRID_LINES ||
          parsed.data.length / parsed.data.gridSpacing > MAX_GRID_LINES
        )
          return { ok: false, error: 'Grid spacing is too small for this floor' };
        record();
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
    };
  });
}

export const useEditorStore = createEditorStore();
