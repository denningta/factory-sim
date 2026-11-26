import type { EquipmentBehavior } from '@factory-sim/schema';

export type Vec3 = [number, number, number];

/**
 * What a part is made of. Every role maps to one shared material (`materials.ts`); only
 * `body` takes the equipment's own color, so a whole line reads as one palette.
 */
export const MATERIAL_ROLES = ['frame', 'body', 'accent', 'dark', 'glass', 'screen'] as const;
export type MaterialRole = (typeof MATERIAL_ROLES)[number];

interface PartBase {
  role: MaterialRole;
  /** Center of the part, in model space (see `ModelDefinition.build`). */
  position: Vec3;
  /**
   * Legs, posts, rails, poles: built at their real size (m), not in proportion to the
   * footprint, so a bigger machine doesn't get thicker legs. Shrunk only to fit tiny footprints.
   */
  fixed?: boolean;
}

export type ModelPart = PartBase &
  (
    | { shape: 'box'; size: Vec3 }
    | {
        shape: 'cylinder';
        radiusTop: number;
        radiusBottom: number;
        height: number;
        /** Radial segments; fewer at lower LODs. */
        segments: number;
        /**
         * `'z'`: lying along the length axis (a pressure vessel), `position` at its center,
         * `radiusBottom` at the -z end and `radiusTop` at the +z end. Absent: standing upright.
         */
        axis?: 'z';
      }
  );

/** Equipment size in meters: footprint width (x), length (z) and height (y). */
export interface ModelSize {
  width: number;
  length: number;
  height: number;
}

/** Points in model space where other layers attach things. */
export interface ModelAnchors {
  /** Above the top, where a name or flag floats. */
  label: Vec3;
  /** Where parts are handed in and out. */
  input: Vec3;
  output: Vec3;
  /** Where the i-th waiting part rests (its bottom center). Defined for every i ≥ 0. */
  queueSlot: (i: number) => Vec3;
  /** Workstations: the signal light, and where the operator stands. */
  statusLight?: Vec3;
  operator?: Vec3;
  /**
   * Workstations drawn as a bench or machine (SF-1). `workSurface`: where the part in process
   * sits. `inTray` / `outTray`: slots on top where parts are handed in and picked up.
   * `operatorFacing`: unit vector (x, 0, z) the operator at `operator` looks along; when set,
   * `operator` is on the floor just outside the front edge instead of inside the footprint.
   */
  workSurface?: Vec3;
  inTray?: Vec3[];
  outTray?: Vec3[];
  operatorFacing?: Vec3;
}

export interface ModelBuild {
  /** Parts per level of detail: index 0 is full detail, the last is the cheapest. */
  lods: ModelPart[][];
  anchors: ModelAnchors;
}

export interface ModelDefinition {
  /** Kebab-case id stored in `model` on types and instances (ADR-0015). */
  id: string;
  label: string;
  /** Behaviors this model may stand for; the picker offers it only for these. */
  behaviors: readonly EquipmentBehavior[];
  /**
   * Camera distances (m), ascending, at which the next LOD takes over: beyond
   * `lodDistances[k]` level k + 1 is drawn. One fewer entry than `build().lods`.
   */
  lodDistances: readonly number[];
  /**
   * Builds the model at a size. Model space: meters, origin at the footprint center on the
   * floor, x across the width, z along the length, y up. Must be deterministic, and the part
   * list's structure (count, shapes, roles, cylinder taper) must not depend on size, because
   * instances of one model share instanced meshes.
   */
  build: (size: ModelSize, params: Readonly<Record<string, unknown>>) => ModelBuild;
}
