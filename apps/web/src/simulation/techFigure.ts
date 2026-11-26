import * as THREE from 'three';
import type { TechPose } from './techTracks';

/** Swing angles (radians about the x axis, positive = forward) of each limb. */
export interface LimbAngles {
  armL: number;
  armR: number;
  legL: number;
  legR: number;
}

/** Meters walked per full walk cycle (two steps). */
export const STRIDE = 1.4;
const WORK_ARM = 1.35; // ~77°: forearms up and out toward the bench
const LEG_SWING = 0.55;
const ARM_SWING = 0.45;

/**
 * Limb angles for a pose. The cycle phase is the distance walked, which the sim clock fixes, so
 * the same sim time always draws the same step (ADR-0008) and playback speed speeds up the stride.
 */
export function limbAngles(pose: Pick<TechPose, 'state' | 'walked'>): LimbAngles {
  if (pose.state === 'standing') return { armL: WORK_ARM, armR: WORK_ARM, legL: 0, legR: 0 };
  const s = Math.sin((2 * Math.PI * pose.walked) / STRIDE);
  // Arms swing against the leg on their own side, as people do.
  return { legL: LEG_SWING * s, legR: -LEG_SWING * s, armL: -ARM_SWING * s, armR: ARM_SWING * s };
}

/** A tech's vest colour: a fixed palette by order in the project, so it is stable across runs. */
export function techColor(palette: readonly string[], order: number): string {
  return palette[order % palette.length]!;
}

/** Body dimensions (m). The figure is ~1.7 m tall and faces +z at heading 0. */
export const FIGURE = {
  hipY: 0.85,
  shoulderY: 1.4,
  legLength: 0.85,
  armLength: 0.6,
  legX: 0.1,
  armX: 0.27,
  headY: 1.57,
} as const;

/** Geometry per part. Limbs hang from their pivot so a rotation swings them from hip/shoulder. */
export function createFigureGeometries() {
  const limb = (w: number, len: number, d: number) =>
    new THREE.BoxGeometry(w, len, d).translate(0, -len / 2, 0);
  return {
    head: new THREE.SphereGeometry(0.12, 10, 8).translate(0, FIGURE.headY, 0),
    torso: new THREE.BoxGeometry(0.4, 0.55, 0.22).translate(0, 1.125, 0),
    // The vest sits just proud of the torso so its colour reads from front, back and sides.
    vest: new THREE.BoxGeometry(0.46, 0.52, 0.28).translate(0, 1.125, 0),
    arm: limb(0.1, FIGURE.armLength, 0.1),
    leg: limb(0.15, FIGURE.legLength, 0.17),
  };
}

/** Instances per figure: head, torso, vest, 2 arms, 2 legs. */
const PER_FIGURE = { head: 1, torso: 1, vest: 1, arm: 2, leg: 2 } as const;

/** Triangles in one figure (all parts), for the ADR-0014 budget. */
export function figureTriangleCount(): number {
  const g = createFigureGeometries();
  let total = 0;
  for (const key of Object.keys(g) as (keyof typeof g)[]) {
    const geo = g[key];
    total += ((geo.index?.count ?? geo.attributes.position!.count) / 3) * PER_FIGURE[key];
    geo.dispose();
  }
  return total;
}
